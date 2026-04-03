import { Router, type Request, type Response } from "express";
import { and, eq } from "drizzle-orm";
import Stripe from "stripe";
import { db, billingSubscriptionsTable, stripeEventsTable } from "@workspace/db";
import { APP_URL } from "../lib/auth.js";
import { stripe, STRIPE_WEBHOOK_SECRET, getTeamPriceId, type BillingInterval } from "../lib/stripe.js";

const router = Router();

type CheckoutBody = {
  interval?: BillingInterval;
};

function requireAuth(req: Request, res: Response): req is Request & { user: { id: string; email?: string | null } } {
  if (!req.isAuthenticated?.() || !req.user?.id) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
}

async function upsertBillingRecord(userId: string, update: Partial<typeof billingSubscriptionsTable.$inferInsert>) {
  await db
    .insert(billingSubscriptionsTable)
    .values({
      userId,
      ...update,
    })
    .onConflictDoUpdate({
      target: billingSubscriptionsTable.userId,
      set: {
        ...update,
        updatedAt: new Date(),
      },
    });
}

async function getBillingByCustomerId(customerId: string) {
  const [row] = await db
    .select()
    .from(billingSubscriptionsTable)
    .where(eq(billingSubscriptionsTable.stripeCustomerId, customerId));
  return row ?? null;
}

async function getBillingBySubscriptionId(subscriptionId: string) {
  const [row] = await db
    .select()
    .from(billingSubscriptionsTable)
    .where(eq(billingSubscriptionsTable.stripeSubscriptionId, subscriptionId));
  return row ?? null;
}

router.post("/billing/checkout", async (req: Request, res: Response) => {
  if (!requireAuth(req, res)) return;

  const interval = req.body?.interval === "year" ? "year" : "month";
  const priceId = getTeamPriceId(interval);
  const userId = req.user.id;

  const [existing] = await db
    .select()
    .from(billingSubscriptionsTable)
    .where(eq(billingSubscriptionsTable.userId, userId));

  let customerId = existing?.stripeCustomerId ?? null;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: req.user.email ?? undefined,
      metadata: {
        userId,
      },
    });
    customerId = customer.id;
    await upsertBillingRecord(userId, {
      stripeCustomerId: customerId,
      status: existing?.status ?? "incomplete",
    });
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    client_reference_id: userId,
    line_items: [{ price: priceId, quantity: 1 }],
    allow_promotion_codes: true,
    success_url: `${APP_URL}/dashboard?billing=success`,
    cancel_url: `${APP_URL}/dashboard?billing=canceled`,
  });

  if (!session.url) {
    res.status(500).json({ error: "Failed to create checkout session" });
    return;
  }

  res.json({ url: session.url });
});

router.post("/billing/portal", async (req: Request, res: Response) => {
  if (!requireAuth(req, res)) return;

  const [existing] = await db
    .select()
    .from(billingSubscriptionsTable)
    .where(eq(billingSubscriptionsTable.userId, req.user.id));

  if (!existing?.stripeCustomerId) {
    res.status(400).json({ error: "billing_not_configured" });
    return;
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: existing.stripeCustomerId,
    return_url: `${APP_URL}/dashboard`,
  });

  res.json({ url: session.url });
});

router.post("/billing/webhook", async (req: Request, res: Response) => {
  const signature = req.header("stripe-signature");
  if (!signature) {
    res.status(400).json({ error: "Missing stripe-signature header" });
    return;
  }

  const rawBody = req.body instanceof Buffer ? req.body : Buffer.from(req.body ?? "");

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, STRIPE_WEBHOOK_SECRET);
  } catch (error) {
    console.error("Stripe webhook signature verification failed", error);
    res.status(400).json({ error: "Invalid signature" });
    return;
  }

  const existingEvent = await db
    .select()
    .from(stripeEventsTable)
    .where(eq(stripeEventsTable.stripeEventId, event.id));

  if (existingEvent.length > 0) {
    res.json({ received: true, duplicate: true });
    return;
  }

  await db
    .insert(stripeEventsTable)
    .values({
      stripeEventId: event.id,
      type: event.type,
    })
    .onConflictDoNothing();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const customerId = typeof session.customer === "string" ? session.customer : null;
        const subscriptionId = typeof session.subscription === "string" ? session.subscription : null;
        const userId = session.client_reference_id ?? session.metadata?.userId;

        if (userId) {
          await upsertBillingRecord(userId, {
            stripeCustomerId: customerId ?? undefined,
            stripeSubscriptionId: subscriptionId ?? undefined,
            status: session.payment_status === "paid" ? "active" : "incomplete",
          });
        }
        break;
      }
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = typeof subscription.customer === "string" ? subscription.customer : null;
        const priceId = subscription.items.data[0]?.price?.id;
        const record =
          (customerId ? await getBillingByCustomerId(customerId) : null) ??
          (subscription.id ? await getBillingBySubscriptionId(subscription.id) : null);

        if (record) {
          await upsertBillingRecord(record.userId, {
            stripeCustomerId: customerId ?? record.stripeCustomerId,
            stripeSubscriptionId: subscription.id,
            stripePriceId: priceId ?? record.stripePriceId,
            status: subscription.status ?? record.status,
            currentPeriodEnd: subscription.current_period_end
              ? new Date(subscription.current_period_end * 1000)
              : record.currentPeriodEnd ?? undefined,
            cancelAtPeriodEnd: subscription.cancel_at_period_end ?? false,
          });
        }
        break;
      }
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = typeof subscription.customer === "string" ? subscription.customer : null;
        const record =
          (customerId ? await getBillingByCustomerId(customerId) : null) ??
          (subscription.id ? await getBillingBySubscriptionId(subscription.id) : null);

        if (record) {
          await upsertBillingRecord(record.userId, {
            stripeCustomerId: customerId ?? record.stripeCustomerId,
            stripeSubscriptionId: subscription.id,
            stripePriceId: subscription.items.data[0]?.price?.id ?? record.stripePriceId,
            status: "canceled",
            cancelAtPeriodEnd: true,
          });
        }
        break;
      }
      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = typeof invoice.subscription === "string" ? invoice.subscription : null;
        const record = subscriptionId ? await getBillingBySubscriptionId(subscriptionId) : null;
        if (record) {
          await upsertBillingRecord(record.userId, {
            status: "active",
          });
        }
        break;
      }
      default:
        break;
    }

    res.json({ received: true });
  } catch (error) {
    console.error("Stripe webhook processing failed", error);
    res.status(500).json({ error: "Webhook processing failed" });
  }
});

export default router;
