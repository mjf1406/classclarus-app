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
import type * as activity from "../activity.js";
import type * as adminSeed from "../adminSeed.js";
import type * as adminUsers from "../adminUsers.js";
import type * as announcements from "../announcements.js";
import type * as appConfig from "../appConfig.js";
import type * as assignmentScores from "../assignmentScores.js";
import type * as assignments from "../assignments.js";
import type * as attendance from "../attendance.js";
import type * as auth from "../auth.js";
import type * as authz from "../authz.js";
import type * as authzBackfill from "../authzBackfill.js";
import type * as behaviorFolders from "../behaviorFolders.js";
import type * as behaviors from "../behaviors.js";
import type * as billing from "../billing.js";
import type * as billingActions from "../billingActions.js";
import type * as classPermissions from "../classPermissions.js";
import type * as classUserSettings from "../classUserSettings.js";
import type * as classes from "../classes.js";
import type * as classesBackfill from "../classesBackfill.js";
import type * as crons from "../crons.js";
import type * as expectations from "../expectations.js";
import type * as feedback from "../feedback.js";
import type * as files from "../files.js";
import type * as filesInternal from "../filesInternal.js";
import type * as githubCloneSync from "../githubCloneSync.js";
import type * as gradeScales from "../gradeScales.js";
import type * as gradedSubjects from "../gradedSubjects.js";
import type * as groups from "../groups.js";
import type * as http from "../http.js";
import type * as joinCodes from "../joinCodes.js";
import type * as lib_accountDeletion from "../lib/accountDeletion.js";
import type * as lib_admin from "../lib/admin.js";
import type * as lib_announcementLimits from "../lib/announcementLimits.js";
import type * as lib_announcementsCleanup from "../lib/announcementsCleanup.js";
import type * as lib_assigners_randomAssign from "../lib/assigners/randomAssign.js";
import type * as lib_assigners_randomAssignerSchema from "../lib/assigners/randomAssignerSchema.js";
import type * as lib_assignmentScoresCleanup from "../lib/assignmentScoresCleanup.js";
import type * as lib_assignmentsCleanup from "../lib/assignmentsCleanup.js";
import type * as lib_attendanceCleanup from "../lib/attendanceCleanup.js";
import type * as lib_attendanceHistory from "../lib/attendanceHistory.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_authzModel from "../lib/authzModel.js";
import type * as lib_avatarUrl from "../lib/avatarUrl.js";
import type * as lib_behaviorsCleanup from "../lib/behaviorsCleanup.js";
import type * as lib_billingGuards from "../lib/billingGuards.js";
import type * as lib_classActivity from "../lib/classActivity.js";
import type * as lib_classPermissionOverrides from "../lib/classPermissionOverrides.js";
import type * as lib_customFunctions from "../lib/customFunctions.js";
import type * as lib_dueDateKey from "../lib/dueDateKey.js";
import type * as lib_entitlement from "../lib/entitlement.js";
import type * as lib_expectationsCleanup from "../lib/expectationsCleanup.js";
import type * as lib_fileAccess from "../lib/fileAccess.js";
import type * as lib_filesCleanup from "../lib/filesCleanup.js";
import type * as lib_gradeScales_defaults from "../lib/gradeScales/defaults.js";
import type * as lib_gradeScales_gradeScaleSchema from "../lib/gradeScales/gradeScaleSchema.js";
import type * as lib_gradeScales_normalize from "../lib/gradeScales/normalize.js";
import type * as lib_gradeScalesCleanup from "../lib/gradeScalesCleanup.js";
import type * as lib_gradedSubjects_gradedSubjectSchema from "../lib/gradedSubjects/gradedSubjectSchema.js";
import type * as lib_gradedSubjects_normalize from "../lib/gradedSubjects/normalize.js";
import type * as lib_gradedSubjectsCleanup from "../lib/gradedSubjectsCleanup.js";
import type * as lib_groupsCleanup from "../lib/groupsCleanup.js";
import type * as lib_guardianLinks from "../lib/guardianLinks.js";
import type * as lib_joinCodesCleanup from "../lib/joinCodesCleanup.js";
import type * as lib_languages from "../lib/languages.js";
import type * as lib_linkAccessibility from "../lib/linkAccessibility.js";
import type * as lib_permissionSnapshot from "../lib/permissionSnapshot.js";
import type * as lib_pointsBadgeWindow from "../lib/pointsBadgeWindow.js";
import type * as lib_pointsCleanup from "../lib/pointsCleanup.js";
import type * as lib_pointsRoster from "../lib/pointsRoster.js";
import type * as lib_polarEnv from "../lib/polarEnv.js";
import type * as lib_polarErrors from "../lib/polarErrors.js";
import type * as lib_polarSubscription from "../lib/polarSubscription.js";
import type * as lib_presenceEnabled from "../lib/presenceEnabled.js";
import type * as lib_purchaseLimit from "../lib/purchaseLimit.js";
import type * as lib_randomAssignersCleanup from "../lib/randomAssignersCleanup.js";
import type * as lib_rateLimitActions from "../lib/rateLimitActions.js";
import type * as lib_rateLimiter from "../lib/rateLimiter.js";
import type * as lib_razAutoRti from "../lib/razAutoRti.js";
import type * as lib_razLevels from "../lib/razLevels.js";
import type * as lib_rewardsCleanup from "../lib/rewardsCleanup.js";
import type * as lib_rosterNameFormat from "../lib/rosterNameFormat.js";
import type * as lib_seatChartGeometry from "../lib/seatChartGeometry.js";
import type * as lib_seatChartLogic from "../lib/seatChartLogic.js";
import type * as lib_seatLayoutCopy from "../lib/seatLayoutCopy.js";
import type * as lib_seatLayoutTeamSync from "../lib/seatLayoutTeamSync.js";
import type * as lib_seating_gender from "../lib/seating/gender.js";
import type * as lib_seating_history from "../lib/seating/history.js";
import type * as lib_seating_mergeAssignments from "../lib/seating/mergeAssignments.js";
import type * as lib_seating_pipeline from "../lib/seating/pipeline.js";
import type * as lib_seating_runSeatingAlgorithm from "../lib/seating/runSeatingAlgorithm.js";
import type * as lib_seating_scope from "../lib/seating/scope.js";
import type * as lib_seating_settings from "../lib/seating/settings.js";
import type * as lib_seating_solve from "../lib/seating/solve.js";
import type * as lib_seating_types from "../lib/seating/types.js";
import type * as lib_seating_validateOutput from "../lib/seating/validateOutput.js";
import type * as lib_seating_validators from "../lib/seating/validators.js";
import type * as lib_seedTestStudents from "../lib/seedTestStudents.js";
import type * as lib_selfHosted from "../lib/selfHosted.js";
import type * as lib_studentRosters from "../lib/studentRosters.js";
import type * as lib_tasksCleanup from "../lib/tasksCleanup.js";
import type * as lib_trial from "../lib/trial.js";
import type * as lib_uploadPresets from "../lib/uploadPresets.js";
import type * as lib_usageTracking from "../lib/usageTracking.js";
import type * as lib_userImage from "../lib/userImage.js";
import type * as lib_zipEntries from "../lib/zipEntries.js";
import type * as linkAccessibility from "../linkAccessibility.js";
import type * as members from "../members.js";
import type * as permissions from "../permissions.js";
import type * as points from "../points.js";
import type * as polar from "../polar.js";
import type * as polarReconcile from "../polarReconcile.js";
import type * as presence from "../presence.js";
import type * as randomAssigners from "../randomAssigners.js";
import type * as raz from "../raz.js";
import type * as rewardFolders from "../rewardFolders.js";
import type * as rewards from "../rewards.js";
import type * as seatAlgorithmSettings from "../seatAlgorithmSettings.js";
import type * as seatCharts from "../seatCharts.js";
import type * as seatChartsRepair from "../seatChartsRepair.js";
import type * as seatConstraints from "../seatConstraints.js";
import type * as seatLayoutAggregatesBackfill from "../seatLayoutAggregatesBackfill.js";
import type * as seatLayouts from "../seatLayouts.js";
import type * as studentRosters from "../studentRosters.js";
import type * as tasks from "../tasks.js";
import type * as trial from "../trial.js";
import type * as trialBackfill from "../trialBackfill.js";
import type * as usage from "../usage.js";
import type * as users from "../users.js";

import type { ApiFromModules, FilterApi, FunctionReference } from "convex/server";

declare const fullApi: ApiFromModules<{
  account: typeof account;
  activity: typeof activity;
  adminSeed: typeof adminSeed;
  adminUsers: typeof adminUsers;
  announcements: typeof announcements;
  appConfig: typeof appConfig;
  assignmentScores: typeof assignmentScores;
  assignments: typeof assignments;
  attendance: typeof attendance;
  auth: typeof auth;
  authz: typeof authz;
  authzBackfill: typeof authzBackfill;
  behaviorFolders: typeof behaviorFolders;
  behaviors: typeof behaviors;
  billing: typeof billing;
  billingActions: typeof billingActions;
  classPermissions: typeof classPermissions;
  classUserSettings: typeof classUserSettings;
  classes: typeof classes;
  classesBackfill: typeof classesBackfill;
  crons: typeof crons;
  expectations: typeof expectations;
  feedback: typeof feedback;
  files: typeof files;
  filesInternal: typeof filesInternal;
  githubCloneSync: typeof githubCloneSync;
  gradeScales: typeof gradeScales;
  gradedSubjects: typeof gradedSubjects;
  groups: typeof groups;
  http: typeof http;
  joinCodes: typeof joinCodes;
  "lib/accountDeletion": typeof lib_accountDeletion;
  "lib/admin": typeof lib_admin;
  "lib/announcementLimits": typeof lib_announcementLimits;
  "lib/announcementsCleanup": typeof lib_announcementsCleanup;
  "lib/assigners/randomAssign": typeof lib_assigners_randomAssign;
  "lib/assigners/randomAssignerSchema": typeof lib_assigners_randomAssignerSchema;
  "lib/assignmentScoresCleanup": typeof lib_assignmentScoresCleanup;
  "lib/assignmentsCleanup": typeof lib_assignmentsCleanup;
  "lib/attendanceCleanup": typeof lib_attendanceCleanup;
  "lib/attendanceHistory": typeof lib_attendanceHistory;
  "lib/auth": typeof lib_auth;
  "lib/authzModel": typeof lib_authzModel;
  "lib/avatarUrl": typeof lib_avatarUrl;
  "lib/behaviorsCleanup": typeof lib_behaviorsCleanup;
  "lib/billingGuards": typeof lib_billingGuards;
  "lib/classActivity": typeof lib_classActivity;
  "lib/classPermissionOverrides": typeof lib_classPermissionOverrides;
  "lib/customFunctions": typeof lib_customFunctions;
  "lib/dueDateKey": typeof lib_dueDateKey;
  "lib/entitlement": typeof lib_entitlement;
  "lib/expectationsCleanup": typeof lib_expectationsCleanup;
  "lib/fileAccess": typeof lib_fileAccess;
  "lib/filesCleanup": typeof lib_filesCleanup;
  "lib/gradeScales/defaults": typeof lib_gradeScales_defaults;
  "lib/gradeScales/gradeScaleSchema": typeof lib_gradeScales_gradeScaleSchema;
  "lib/gradeScales/normalize": typeof lib_gradeScales_normalize;
  "lib/gradeScalesCleanup": typeof lib_gradeScalesCleanup;
  "lib/gradedSubjects/gradedSubjectSchema": typeof lib_gradedSubjects_gradedSubjectSchema;
  "lib/gradedSubjects/normalize": typeof lib_gradedSubjects_normalize;
  "lib/gradedSubjectsCleanup": typeof lib_gradedSubjectsCleanup;
  "lib/groupsCleanup": typeof lib_groupsCleanup;
  "lib/guardianLinks": typeof lib_guardianLinks;
  "lib/joinCodesCleanup": typeof lib_joinCodesCleanup;
  "lib/languages": typeof lib_languages;
  "lib/linkAccessibility": typeof lib_linkAccessibility;
  "lib/permissionSnapshot": typeof lib_permissionSnapshot;
  "lib/pointsBadgeWindow": typeof lib_pointsBadgeWindow;
  "lib/pointsCleanup": typeof lib_pointsCleanup;
  "lib/pointsRoster": typeof lib_pointsRoster;
  "lib/polarEnv": typeof lib_polarEnv;
  "lib/polarErrors": typeof lib_polarErrors;
  "lib/polarSubscription": typeof lib_polarSubscription;
  "lib/presenceEnabled": typeof lib_presenceEnabled;
  "lib/purchaseLimit": typeof lib_purchaseLimit;
  "lib/randomAssignersCleanup": typeof lib_randomAssignersCleanup;
  "lib/rateLimitActions": typeof lib_rateLimitActions;
  "lib/rateLimiter": typeof lib_rateLimiter;
  "lib/razAutoRti": typeof lib_razAutoRti;
  "lib/razLevels": typeof lib_razLevels;
  "lib/rewardsCleanup": typeof lib_rewardsCleanup;
  "lib/rosterNameFormat": typeof lib_rosterNameFormat;
  "lib/seatChartGeometry": typeof lib_seatChartGeometry;
  "lib/seatChartLogic": typeof lib_seatChartLogic;
  "lib/seatLayoutCopy": typeof lib_seatLayoutCopy;
  "lib/seatLayoutTeamSync": typeof lib_seatLayoutTeamSync;
  "lib/seating/gender": typeof lib_seating_gender;
  "lib/seating/history": typeof lib_seating_history;
  "lib/seating/mergeAssignments": typeof lib_seating_mergeAssignments;
  "lib/seating/pipeline": typeof lib_seating_pipeline;
  "lib/seating/runSeatingAlgorithm": typeof lib_seating_runSeatingAlgorithm;
  "lib/seating/scope": typeof lib_seating_scope;
  "lib/seating/settings": typeof lib_seating_settings;
  "lib/seating/solve": typeof lib_seating_solve;
  "lib/seating/types": typeof lib_seating_types;
  "lib/seating/validateOutput": typeof lib_seating_validateOutput;
  "lib/seating/validators": typeof lib_seating_validators;
  "lib/seedTestStudents": typeof lib_seedTestStudents;
  "lib/selfHosted": typeof lib_selfHosted;
  "lib/studentRosters": typeof lib_studentRosters;
  "lib/tasksCleanup": typeof lib_tasksCleanup;
  "lib/trial": typeof lib_trial;
  "lib/uploadPresets": typeof lib_uploadPresets;
  "lib/usageTracking": typeof lib_usageTracking;
  "lib/userImage": typeof lib_userImage;
  "lib/zipEntries": typeof lib_zipEntries;
  linkAccessibility: typeof linkAccessibility;
  members: typeof members;
  permissions: typeof permissions;
  points: typeof points;
  polar: typeof polar;
  polarReconcile: typeof polarReconcile;
  presence: typeof presence;
  randomAssigners: typeof randomAssigners;
  raz: typeof raz;
  rewardFolders: typeof rewardFolders;
  rewards: typeof rewards;
  seatAlgorithmSettings: typeof seatAlgorithmSettings;
  seatCharts: typeof seatCharts;
  seatChartsRepair: typeof seatChartsRepair;
  seatConstraints: typeof seatConstraints;
  seatLayoutAggregatesBackfill: typeof seatLayoutAggregatesBackfill;
  seatLayouts: typeof seatLayouts;
  studentRosters: typeof studentRosters;
  tasks: typeof tasks;
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
