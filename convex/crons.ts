import { cronJobs } from "convex/server";

import { internal } from "./_generated/api.js";

const crons = cronJobs();

crons.daily(
  "reconcile polar subscriptions",
  { hourUTC: 5, minuteUTC: 0 },
  internal.polarReconcile.reconcileSubscriptions,
  {},
);

crons.daily(
  "sync github clone traffic",
  { hourUTC: 6, minuteUTC: 0 },
  internal.githubCloneSync.syncGithubClones,
);

crons.interval(
  "expire overdue trial grants",
  { minutes: 5 },
  internal.trial.expireLapsedGrants,
  {},
);

export default crons;
