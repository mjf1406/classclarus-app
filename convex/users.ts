import { getAuthSessionId, getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";

import { query } from "./_generated/server.js";
import { listLinkedProviders } from "./lib/accountDeletion.js";
import { authedMutation, authedQuery } from "./lib/customFunctions.js";
import { requireFileOwner } from "./lib/fileAccess.js";
import { languageValidator } from "./lib/languages.js";
import { rateLimiter } from "./lib/rateLimiter.js";
import { isSelfHosted } from "./lib/selfHosted.js";
import { deleteOwnedAvatarFile, resolveUserImageUrl } from "./lib/userImage.js";

export { languageValidator };

const userSettingsValidator = v.object({
  _id: v.id("userSettings"),
  _creationTime: v.number(),
  userId: v.id("users"),
  language: languageValidator,
});

const currentUserValidator = v.object({
  _id: v.id("users"),
  _creationTime: v.number(),
  name: v.optional(v.string()),
  image: v.optional(v.string()),
  avatarFileId: v.optional(v.id("files")),
  email: v.optional(v.string()),
  emailVerificationTime: v.optional(v.number()),
  phone: v.optional(v.string()),
  phoneVerificationTime: v.optional(v.number()),
  isAnonymous: v.optional(v.boolean()),
  settings: v.union(userSettingsValidator, v.null()),
  providers: v.array(v.string()),
});

const currentSessionValidator = v.object({
  _id: v.id("authSessions"),
  _creationTime: v.number(),
  userId: v.id("users"),
  expirationTime: v.number(),
});

export const currentUser = query({
  args: {},
  returns: v.union(currentUserValidator, v.null()),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return null;
    }
    const user = await ctx.db.get("users", userId);
    if (!user) {
      return null;
    }
    const settings = await ctx.db
      .query("userSettings")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    const providers = await listLinkedProviders(ctx, userId);
    const image = await resolveUserImageUrl(ctx, user);
    return {
      ...user,
      image,
      settings: settings ?? null,
      providers,
    };
  },
});

export const currentSession = authedQuery({
  args: {},
  returns: v.union(currentSessionValidator, v.null()),
  handler: async (ctx) => {
    const sessionId = await getAuthSessionId(ctx);
    if (sessionId === null) {
      return null;
    }
    return await ctx.db.get("authSessions", sessionId);
  },
});

export const updateLanguage = authedMutation({
  args: {
    language: languageValidator,
  },
  returns: userSettingsValidator,
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "updateLanguage", { key: ctx.userId, throws: true });
    const userId = ctx.userId;

    const existing = await ctx.db
      .query("userSettings")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();

    if (existing) {
      await ctx.db.patch("userSettings", existing._id, { language: args.language });
      const updated = await ctx.db.get("userSettings", existing._id);
      if (!updated) {
        throw new Error("Failed to update language settings");
      }
      return updated;
    }

    const settingsId = await ctx.db.insert("userSettings", {
      userId,
      language: args.language,
    });
    const created = await ctx.db.get("userSettings", settingsId);
    if (!created) {
      throw new Error("Failed to create language settings");
    }
    return created;
  },
});

/**
 * Self-host / Electron only — password accounts can edit display name.
 * Stored as a single `users.name` ("First Last").
 */
export const updateDisplayName = authedMutation({
  args: {
    firstName: v.string(),
    lastName: v.string(),
  },
  returns: v.object({
    name: v.string(),
  }),
  handler: async (ctx, args) => {
    if (!isSelfHosted()) {
      throw new ConvexError({
        code: "SELF_HOSTED_ONLY",
        message: "Profile name can only be edited in self-hosted mode.",
      });
    }
    await rateLimiter.limit(ctx, "updateDisplayName", { key: ctx.userId, throws: true });

    const firstName = args.firstName.trim();
    const lastName = args.lastName.trim();
    if (!firstName || !lastName) {
      throw new ConvexError({
        code: "NAME_REQUIRED",
        message: "First and last name are required.",
      });
    }
    if (firstName.length > 80 || lastName.length > 80) {
      throw new ConvexError({
        code: "NAME_TOO_LONG",
        message: "Name is too long.",
      });
    }

    const name = `${firstName} ${lastName}`;
    await ctx.db.patch("users", ctx.userId, { name });
    return { name };
  },
});

/**
 * Self-host / Electron only — set profile photo from a finalized personal image upload.
 */
export const updateAvatar = authedMutation({
  args: {
    fileId: v.id("files"),
  },
  returns: v.object({
    image: v.union(v.string(), v.null()),
    avatarFileId: v.id("files"),
  }),
  handler: async (ctx, args) => {
    if (!isSelfHosted()) {
      throw new ConvexError({
        code: "SELF_HOSTED_ONLY",
        message: "Profile photo can only be edited in self-hosted mode.",
      });
    }
    await rateLimiter.limit(ctx, "updateAvatar", { key: ctx.userId, throws: true });

    const file = await requireFileOwner(ctx, args.fileId, ctx.userId);
    if (file.classId !== undefined || file.preset !== "images") {
      throw new ConvexError({
        code: "INVALID_AVATAR",
        message: "Avatar must be a personal image upload.",
      });
    }

    const user = await ctx.db.get("users", ctx.userId);
    if (!user) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "Not authenticated",
      });
    }

    const previousAvatarFileId = user.avatarFileId;
    await ctx.db.patch("users", ctx.userId, {
      avatarFileId: args.fileId,
      // Clear provider URL so resolve prefers the uploaded file.
      image: undefined,
    });

    if (previousAvatarFileId !== undefined && previousAvatarFileId !== args.fileId) {
      await deleteOwnedAvatarFile(ctx, previousAvatarFileId, ctx.userId);
    }

    const image =
      (await resolveUserImageUrl(ctx, { avatarFileId: args.fileId, image: undefined })) ?? null;
    return { image, avatarFileId: args.fileId };
  },
});

/**
 * Self-host / Electron only — remove the uploaded profile photo.
 */
export const clearAvatar = authedMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    if (!isSelfHosted()) {
      throw new ConvexError({
        code: "SELF_HOSTED_ONLY",
        message: "Profile photo can only be edited in self-hosted mode.",
      });
    }
    await rateLimiter.limit(ctx, "clearAvatar", { key: ctx.userId, throws: true });

    const user = await ctx.db.get("users", ctx.userId);
    if (!user) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "Not authenticated",
      });
    }

    const previousAvatarFileId = user.avatarFileId;
    await ctx.db.patch("users", ctx.userId, {
      avatarFileId: undefined,
      image: undefined,
    });
    if (previousAvatarFileId !== undefined) {
      await deleteOwnedAvatarFile(ctx, previousAvatarFileId, ctx.userId);
    }
    return null;
  },
});
