import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

router.get("/profile", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, req.user.id));

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json({
    id: user.id,
    email: user.email ?? null,
    fullName: [user.firstName, user.lastName].filter(Boolean).join(" ") || null,
    createdAt: user.createdAt,
  });
});

router.put("/profile", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const userId = req.user.id;
  const { fullName, email } = req.body;

  const nameParts = fullName ? fullName.split(" ") : [];
  const firstName = nameParts[0] ?? null;
  const lastName = nameParts.slice(1).join(" ") || null;

  const [updated] = await db
    .update(usersTable)
    .set({
      firstName: firstName ?? req.user.firstName,
      lastName: lastName ?? req.user.lastName,
      email: email ?? req.user.email,
    })
    .where(eq(usersTable.id, userId))
    .returning();

  res.json({
    id: updated.id,
    email: updated.email ?? null,
    fullName: [updated.firstName, updated.lastName].filter(Boolean).join(" ") || null,
    createdAt: updated.createdAt,
  });
});

export default router;
