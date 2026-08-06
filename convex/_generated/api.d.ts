/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as account from "../account.js";
import type * as adminUsers from "../adminUsers.js";
import type * as appConfig from "../appConfig.js";
import type * as auth from "../auth.js";
import type * as authz from "../authz.js";
import type * as authzBackfill from "../authzBackfill.js";
import type * as billing from "../billing.js";
import type * as billingActions from "../billingActions.js";
import type * as classes from "../classes.js";
import type * as crons from "../crons.js";
import type * as feedback from "../feedback.js";
import type * as files from "../files.js";
import type * as filesInternal from "../filesInternal.js";
import type * as githubCloneSync from "../githubCloneSync.js";
import type * as http from "../http.js";
import type * as joinCodes from "../joinCodes.js";
import type * as lib_accountDeletion from "../lib/accountDeletion.js";
import type * as lib_admin from "../lib/admin.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_authzModel from "../lib/authzModel.js";
import type * as lib_avatarUrl from "../lib/avatarUrl.js";
import type * as lib_billingGuards from "../lib/billingGuards.js";
import type * as lib_customFunctions from "../lib/customFunctions.js";
import type * as lib_entitlement from "../lib/entitlement.js";
import type * as lib_fileAccess from "../lib/fileAccess.js";
import type * as lib_filesCleanup from "../lib/filesCleanup.js";
import type * as lib_guardianLinks from "../lib/guardianLinks.js";
import type * as lib_joinCodesCleanup from "../lib/joinCodesCleanup.js";
import type * as lib_languages from "../lib/languages.js";
import type * as lib_permissionSnapshot from "../lib/permissionSnapshot.js";
import type * as lib_polarEnv from "../lib/polarEnv.js";
import type * as lib_polarErrors from "../lib/polarErrors.js";
import type * as lib_polarSubscription from "../lib/polarSubscription.js";
import type * as lib_rateLimitActions from "../lib/rateLimitActions.js";
import type * as lib_rateLimiter from "../lib/rateLimiter.js";
import type * as lib_selfHosted from "../lib/selfHosted.js";
import type * as lib_trial from "../lib/trial.js";
import type * as lib_uploadPresets from "../lib/uploadPresets.js";
import type * as lib_usageTracking from "../lib/usageTracking.js";
import type * as lib_userImage from "../lib/userImage.js";
import type * as lib_zipEntries from "../lib/zipEntries.js";
import type * as members from "../members.js";
import type * as permissions from "../permissions.js";
import type * as polar from "../polar.js";
import type * as polarReconcile from "../polarReconcile.js";
import type * as presence from "../presence.js";
import type * as trial from "../trial.js";
import type * as trialBackfill from "../trialBackfill.js";
import type * as usage from "../usage.js";
import type * as users from "../users.js";

import type { ApiFromModules, FilterApi, FunctionReference } from "convex/server";

declare const fullApi: ApiFromModules<{
  account: typeof account;
  adminUsers: typeof adminUsers;
  appConfig: typeof appConfig;
  auth: typeof auth;
  authz: typeof authz;
  authzBackfill: typeof authzBackfill;
  billing: typeof billing;
  billingActions: typeof billingActions;
  classes: typeof classes;
  crons: typeof crons;
  feedback: typeof feedback;
  files: typeof files;
  filesInternal: typeof filesInternal;
  githubCloneSync: typeof githubCloneSync;
  http: typeof http;
  joinCodes: typeof joinCodes;
  "lib/accountDeletion": typeof lib_accountDeletion;
  "lib/admin": typeof lib_admin;
  "lib/auth": typeof lib_auth;
  "lib/authzModel": typeof lib_authzModel;
  "lib/avatarUrl": typeof lib_avatarUrl;
  "lib/billingGuards": typeof lib_billingGuards;
  "lib/customFunctions": typeof lib_customFunctions;
  "lib/entitlement": typeof lib_entitlement;
  "lib/fileAccess": typeof lib_fileAccess;
  "lib/filesCleanup": typeof lib_filesCleanup;
  "lib/guardianLinks": typeof lib_guardianLinks;
  "lib/joinCodesCleanup": typeof lib_joinCodesCleanup;
  "lib/languages": typeof lib_languages;
  "lib/permissionSnapshot": typeof lib_permissionSnapshot;
  "lib/polarEnv": typeof lib_polarEnv;
  "lib/polarErrors": typeof lib_polarErrors;
  "lib/polarSubscription": typeof lib_polarSubscription;
  "lib/rateLimitActions": typeof lib_rateLimitActions;
  "lib/rateLimiter": typeof lib_rateLimiter;
  "lib/selfHosted": typeof lib_selfHosted;
  "lib/trial": typeof lib_trial;
  "lib/uploadPresets": typeof lib_uploadPresets;
  "lib/usageTracking": typeof lib_usageTracking;
  "lib/userImage": typeof lib_userImage;
  "lib/zipEntries": typeof lib_zipEntries;
  members: typeof members;
  permissions: typeof permissions;
  polar: typeof polar;
  polarReconcile: typeof polarReconcile;
  presence: typeof presence;
  trial: typeof trial;
  trialBackfill: typeof trialBackfill;
  usage: typeof usage;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<typeof fullApi, FunctionReference<any, "public">>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<typeof fullApi, FunctionReference<any, "internal">>;

export declare const components: {
  authz: import("@djpanda/convex-authz/_generated/component.js").ComponentApi<"authz">;
  rateLimiter: import("@convex-dev/rate-limiter/_generated/component.js").ComponentApi<"rateLimiter">;
  polar: import("@convex-dev/polar/_generated/component.js").ComponentApi<"polar">;
  presence: import("@convex-dev/presence/_generated/component.js").ComponentApi<"presence">;
  usageByKind: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"usageByKind">;
  usageByDownloadOs: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"usageByDownloadOs">;
  githubClones: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"githubClones">;
};
