import { v } from "convex/values";

import { APP_CONFIG } from "./appConfig.js";
import { internal } from "./_generated/api.js";
import { internalAction, internalMutation } from "./_generated/server.js";
import {
  CI_CHECKOUTS_PER_ELECTRON_RELEASE,
  githubClonesAggregate,
  isUsageTrackingEnabled,
  parseGithubOwnerRepo,
  utcDayKey,
  utcDayStartMs,
} from "./lib/usageTracking.js";

type TrafficCloneDay = {
  timestamp: string;
  count: number;
  uniques: number;
};

type TrafficClonesResponse = {
  count: number;
  uniques: number;
  clones: TrafficCloneDay[];
};

type WorkflowRunsResponse = {
  workflow_runs: Array<{
    id: number;
    created_at: string;
    updated_at: string;
    status: string;
    conclusion: string | null;
  }>;
};

async function githubGet<T>(path: string, token: string): Promise<T> {
  const response = await fetch(`https://api.github.com${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": `${APP_CONFIG.slug}-usage-sync`,
    },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GitHub API ${path} failed (${response.status}): ${body.slice(0, 200)}`);
  }
  return (await response.json()) as T;
}

function dayKeyFromGithubTimestamp(timestamp: string): string {
  return timestamp.slice(0, 10);
}

/** Count electron-release workflow runs that finished on the given UTC day. */
async function countElectronReleaseRunsForDay(
  owner: string,
  repo: string,
  dayKey: string,
  token: string,
): Promise<number> {
  const dayStart = utcDayStartMs(Date.parse(`${dayKey}T00:00:00.000Z`));
  const dayEnd = dayStart + 24 * 60 * 60 * 1000;
  const createdMin = new Date(dayStart - 2 * 24 * 60 * 60 * 1000).toISOString();
  const createdMax = new Date(dayEnd + 2 * 24 * 60 * 60 * 1000).toISOString();

  const data = await githubGet<WorkflowRunsResponse>(
    `/repos/${owner}/${repo}/actions/workflows/electron-release.yml/runs?per_page=50&created=${encodeURIComponent(`${createdMin}..${createdMax}`)}`,
    token,
  );

  let runs = 0;
  for (const run of data.workflow_runs) {
    if (run.status !== "completed") {
      continue;
    }
    const finishedAt = Date.parse(run.updated_at);
    if (finishedAt >= dayStart && finishedAt < dayEnd) {
      runs += 1;
    }
  }
  return runs;
}

export const upsertCloneDay = internalMutation({
  args: {
    dayKey: v.string(),
    rawCount: v.number(),
    ciSubtracted: v.number(),
    count: v.number(),
    uniques: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const dayStartMs = utcDayStartMs(Date.parse(`${args.dayKey}T00:00:00.000Z`));
    const existing = await ctx.db
      .query("githubCloneDays")
      .withIndex("by_dayKey", (q) => q.eq("dayKey", args.dayKey))
      .unique();

    const syncedAt = Date.now();
    if (existing) {
      const oldDoc = existing;
      await ctx.db.patch("githubCloneDays", existing._id, {
        rawCount: args.rawCount,
        ciSubtracted: args.ciSubtracted,
        count: args.count,
        uniques: args.uniques,
        dayStartMs,
        syncedAt,
      });
      const newDoc = await ctx.db.get("githubCloneDays", existing._id);
      if (newDoc) {
        await githubClonesAggregate.replace(ctx, oldDoc, newDoc);
      }
      return null;
    }

    const id = await ctx.db.insert("githubCloneDays", {
      dayKey: args.dayKey,
      dayStartMs,
      rawCount: args.rawCount,
      ciSubtracted: args.ciSubtracted,
      count: args.count,
      uniques: args.uniques,
      syncedAt,
    });
    const doc = await ctx.db.get("githubCloneDays", id);
    if (doc) {
      await githubClonesAggregate.insert(ctx, doc);
    }
    return null;
  },
});

export const syncGithubClones = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    if (!isUsageTrackingEnabled()) {
      return null;
    }

    const token = process.env.GITHUB_TRAFFIC_TOKEN?.trim();
    if (!token) {
      console.warn("usage clone sync skipped: GITHUB_TRAFFIC_TOKEN unset");
      return null;
    }

    const parsed = parseGithubOwnerRepo(APP_CONFIG.github);
    if (!parsed) {
      console.warn("usage clone sync skipped: could not parse APP_CONFIG.github");
      return null;
    }

    const { owner, repo } = parsed;
    const traffic = await githubGet<TrafficClonesResponse>(
      `/repos/${owner}/${repo}/traffic/clones?per=day`,
      token,
    );

    const todayKey = utcDayKey(Date.now());

    for (const day of traffic.clones) {
      const dayKey = dayKeyFromGithubTimestamp(day.timestamp);
      // Today's count is incomplete; still upsert so the chip can show partial data.
      const runs = await countElectronReleaseRunsForDay(owner, repo, dayKey, token);
      const ciSubtracted = runs * CI_CHECKOUTS_PER_ELECTRON_RELEASE;
      const count = Math.max(0, day.count - ciSubtracted);

      await ctx.runMutation(internal.githubCloneSync.upsertCloneDay, {
        dayKey,
        rawCount: day.count,
        ciSubtracted,
        count,
        uniques: day.uniques,
      });
    }

    console.log("GitHub clone sync complete", {
      days: traffic.clones.length,
      todayKey,
    });
    return null;
  },
});
