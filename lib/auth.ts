import { deleteProfilePhoto } from "./profile-photo";
import { deleteUserProofs } from "./proof-storage";
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { database, query } from "./db";
function createAuth() {
  if (process.env.VERCEL && !process.env.BETTER_AUTH_SECRET)
    throw new Error("BETTER_AUTH_SECRET manquant.");
  return betterAuth({
    database: database(),
    secret:
      process.env.BETTER_AUTH_SECRET ||
      "local-development-only-relais-keep-out-of-production",
    baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
    },
    rateLimit: {
      enabled: true,
      storage: "database",
      window: 60,
      max: 30,
      customRules: {
        "/sign-in/email": { window: 60, max: 5 },
        "/sign-up/email": { window: 60, max: 5 },
      },
    },
    user: {
      deleteUser: {
        enabled: true,
        beforeDelete: async (user) => {
          await deleteUserProofs(user.id);
          await deleteProfilePhoto(user.id);
          await query(
            "DELETE FROM follows WHERE follower_id=$1 OR followed_id=$1",
            [user.id],
          );
          await query("DELETE FROM verifications WHERE user_id=$1", [user.id]);

          await query(
            "DELETE FROM accompaniments WHERE beginner_id=$1 OR mentor_id=$1",
            [user.id],
          );
          await query("DELETE FROM profiles WHERE user_id=$1", [user.id]);
        },
      },
    },
    plugins: [nextCookies()],
  });
}
let instance: ReturnType<typeof createAuth> | undefined;
export function getAuth() {
  return (instance ??= createAuth());
}
