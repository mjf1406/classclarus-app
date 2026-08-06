import Google from "@auth/core/providers/google";
import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";

import { authz } from "./authz.js";
import { sanitizeAvatarUrl } from "./lib/avatarUrl.js";
import { isSelfHosted } from "./lib/selfHosted.js";
import { claimTrialGrant } from "./lib/trial.js";

function passwordProfile(params: Record<string, unknown>) {
  const email = String(params.email ?? "").trim();
  const firstName = typeof params.firstName === "string" ? params.firstName.trim() : "";
  const lastName = typeof params.lastName === "string" ? params.lastName.trim() : "";
  const name = [firstName, lastName].filter(Boolean).join(" ");
  return {
    email,
    ...(name.length > 0 ? { name } : {}),
  };
}

const providers = [
  Password({ profile: passwordProfile }),
  ...(process.env.AUTH_GOOGLE_ID ? [Google] : []),
];

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers,
  callbacks: {
    afterUserCreatedOrUpdated: async (ctx, { userId, existingUserId }) => {
      const user = await ctx.db.get("users", userId);
      if (!user) {
        return;
      }
      if (user.email && !isSelfHosted()) {
        await claimTrialGrant(ctx, userId, user.email);
      }
      // First registered account on a self-host / Electron instance becomes admin.
      if (isSelfHosted() && existingUserId === null) {
        const sample = await ctx.db.query("users").take(2);
        if (sample.length === 1) {
          await authz.assignRole(ctx, userId, "app_admin");
        }
      }
      const safeImage = sanitizeAvatarUrl(user.image);
      if (user.image === safeImage || (user.image === undefined && safeImage === null)) {
        return;
      }
      // `patch` cannot unset optional fields; replace without a bad `image`.
      const {
        _id: _ignoredId,
        _creationTime: _ignoredCreation,
        image: _ignoredImage,
        ...rest
      } = user;
      if (safeImage) {
        await ctx.db.replace("users", userId, { ...rest, image: safeImage });
      } else {
        await ctx.db.replace("users", userId, rest);
      }
    },
  },
});
