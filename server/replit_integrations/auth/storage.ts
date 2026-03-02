import { users, type User, type UpsertUser } from "@shared/schema";
import { db } from "../../db";
import { eq } from "drizzle-orm";

export interface IAuthStorage {
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
}

class AuthStorage implements IAuthStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    // On INSERT (new user): use values as-is (emailVerified: false passed explicitly).
    // On conflict (existing user): update profile fields only — do NOT touch emailVerified
    // so verified users don't get reset on every login.
    const { emailVerified: _ev, emailVerificationCode: _vc, emailVerificationExpires: _ve, ...profileData } = userData;
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: { ...profileData, updatedAt: new Date() },
      })
      .returning();
    return user;
  }
}

export const authStorage = new AuthStorage();
