import { getAuthUserId } from "@convex-dev/auth/server";

import type { Id } from "../_generated/dataModel.js";
import type { MutationCtx, QueryCtx } from "../_generated/server.js";

export async function requireAuthUserId(ctx: QueryCtx | MutationCtx): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) {
    throw new Error("Not authenticated");
  }
  return userId;
}
