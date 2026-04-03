import { boolean, index, pgTable, timestamp, varchar, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const billingSubscriptionsTable = pgTable(
  "billing_subscriptions",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").notNull(),
    stripeCustomerId: varchar("stripe_customer_id", { length: 255 }),
    stripeSubscriptionId: varchar("stripe_subscription_id", { length: 255 }),
    stripePriceId: varchar("stripe_price_id", { length: 255 }),
    status: varchar("status", { length: 50 }).notNull().default("incomplete"),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("billing_subscriptions_user_id_unique").on(table.userId),
    index("billing_subscriptions_customer_idx").on(table.stripeCustomerId),
    index("billing_subscriptions_subscription_idx").on(table.stripeSubscriptionId),
  ],
).enableRLS();

export const stripeEventsTable = pgTable(
  "stripe_events",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    stripeEventId: varchar("stripe_event_id", { length: 255 }).notNull(),
    type: varchar("type", { length: 120 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("stripe_events_event_id_unique").on(table.stripeEventId),
    index("stripe_events_type_idx").on(table.type),
  ],
).enableRLS();
