import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Dialog,
  DialogTrigger,
  DialogPortal,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { db } from "@/server/db";
import { behaviors, points, reward_items } from "@/server/db/schema";
import { ACHIEVEMENTS, type AchievementData } from "@/lib/constants";
import { eq, and } from "drizzle-orm";
import { FontAwesomeIconClient } from "@/components/FontAwesomeIconClient";

// Update the type to reflect the actual data coming from the DB.
type PointsData = {
  id: string;
  student_id: string;
  behavior_id: string | null; // Data from DB is string | null.
  type: "positive" | "negative" | "redemption";
  number_of_points: number;
  created_date: string;
  behavior_name?: string | null;
  reward_item_name?: string | null;
  reward_title?: string | null;
  behavior_title?: string | null;
};

export default async function AchievementsCard({
  params,
}: {
  params: Promise<{ classId: string; studentId: string }>;
}) {
  const { classId, studentId } = await params;

  // Fetch points data for the given class and student.
  const data = await db
    .select({
      id: points.id,
      student_id: points.student_id,
      behavior_id: points.behavior_id,
      type: points.type,
      number_of_points: points.number_of_points,
      created_date: points.created_date,
      behavior_name: behaviors.name,
      reward_item_name: reward_items.name,
      reward_title: reward_items.title,
      behavior_title: behaviors.title,
    })
    .from(points)
    .leftJoin(behaviors, eq(behaviors.behavior_id, points.behavior_id))
    .leftJoin(reward_items, eq(reward_items.item_id, points.reward_item_id))
    .where(and(eq(points.class_id, classId), eq(points.student_id, studentId)));

  // Cast the data to our PointsData[] type.
  const pointsHistory: PointsData[] = data;

  // --- Achievements Dashboard Logic ---

  // 1) Convert thresholds to numbers, sorted ascending.
  const achievementThresholds = Object.keys(ACHIEVEMENTS)
    .map((k) => parseInt(k, 10))
    .sort((a, b) => a - b);

  // 2) Group points by "itemKey" (could be behavior_name + reward_item_name).
  const groupedByItem = new Map<string, PointsData[]>();

  pointsHistory.forEach((pt) => {
    const keyParts: string[] = [];
    if (pt.behavior_name) keyParts.push(`Behavior: ${pt.behavior_name}`);
    if (pt.reward_item_name) keyParts.push(`Reward: ${pt.reward_item_name}`);
    const itemKey = keyParts.length > 0 ? keyParts.join(" | ") : "No-Item";
    if (!groupedByItem.has(itemKey)) {
      groupedByItem.set(itemKey, []);
    }
    groupedByItem.get(itemKey)!.push(pt);
  });

  // Grouped data shape for unlocked achievements.
  interface UnlockedAchievement extends AchievementData {
    threshold: number;
    behavior_name: string | null | undefined;
    reward_item_name: string | null | undefined;
    created_date: string;
  }

  interface GroupedData {
    itemKey: string; // e.g. "Behavior: Reading | Reward: Candy"
    count: number; // total relevant points for that group
    unlocked: UnlockedAchievement[]; // Achievements unlocked for this group
    highest: UnlockedAchievement | null; // the largest threshold unlocked (or null)
    nextThreshold: number | undefined; // next threshold after the current count
  }

  // 3) For each group, tally how many “positive/redemption” points were received
  //    and which achievements (thresholds) were unlocked.
  const groupedAchievements: GroupedData[] = Array.from(
    groupedByItem.entries(),
  ).map(([itemKey, itemPoints]) => {
    // Filter only "positive" or "redemption" and sort by date.
    const relevantPoints = itemPoints
      .filter(
        (p: PointsData) => p.type === "positive" || p.type === "redemption",
      )
      .sort(
        (a: PointsData, b: PointsData) =>
          new Date(a.created_date).valueOf() -
          new Date(b.created_date).valueOf(),
      );

    let countSoFar = 0;
    const unlocked: UnlockedAchievement[] = [];

    relevantPoints.forEach((pt: PointsData) => {
      countSoFar++;
      achievementThresholds.forEach((threshold) => {
        if (countSoFar === threshold) {
          const achData = ACHIEVEMENTS[threshold.toString()];
          if (achData) {
            unlocked.push({
              threshold,
              ...achData,
              behavior_name: pt.behavior_name,
              reward_item_name: pt.reward_item_name,
              created_date: pt.created_date,
            });
          }
        }
      });
    });

    // Explicitly assign highest as type UnlockedAchievement | null.
    const highest: UnlockedAchievement | null =
      unlocked.length > 0 ? (unlocked[unlocked.length - 1] ?? null) : null;
    const nextThreshold = achievementThresholds.find((t) => t > countSoFar);

    return {
      itemKey,
      count: countSoFar,
      unlocked,
      highest,
      nextThreshold,
    };
  });

  // 4) Check if there are any achievements.
  const anyAchievements = groupedAchievements.some(
    (g) => g.unlocked.length > 0,
  );

  // 5) Total achievements unlocked overall.
  const totalUnlocked = groupedAchievements.reduce(
    (acc, group) => acc + group.unlocked.length,
    0,
  );

  // Build an array of the highest achievement per group; sort descending and take the top 5.
  const topAchievementsByGroup = groupedAchievements
    .filter((g) => g.highest !== null)
    .map((g) => ({
      ...g.highest!,
      itemKey: g.itemKey,
      count: g.count,
      nextThreshold: g.nextThreshold,
    }));

  const topFive = topAchievementsByGroup
    .sort((a, b) => b.threshold - a.threshold)
    .slice(0, 5);

  // Helper: Pick “Received”, “Redeemed”, or “Used” depending on itemKey.
  function getUsageLabel(itemKey: string, count: number) {
    const hasBehavior = itemKey.includes("Behavior:");
    const hasReward = itemKey.includes("Reward:");
    let verb = "Used";
    if (hasBehavior && !hasReward) {
      verb = "Received";
    } else if (!hasBehavior && hasReward) {
      verb = "Redeemed";
    }
    return `${verb} ${count} time${count !== 1 ? "s" : ""}`;
  }

  // --- Render the Achievements Card ---
  return (
    <Card className="mx-auto w-full">
      <CardHeader>
        <CardTitle>Achievements</CardTitle>
        <CardDescription>
          {anyAchievements
            ? `You've unlocked a total of ${totalUnlocked} achievement${
                totalUnlocked > 1 ? "s" : ""
              } across your items!`
            : "You haven't unlocked any achievements yet."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {anyAchievements ? (
          <>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="secondary" className="w-full">
                  View All Achievements
                </Button>
              </DialogTrigger>
              <DialogPortal>
                <DialogContent className="max-h-[80vh] !w-[90vw] !max-w-[90vw] overflow-auto">
                  <DialogHeader>
                    <DialogTitle>All Achievements</DialogTitle>
                    <DialogDescription className="text-gray-600 dark:text-gray-300">
                      Each behavior/reward item has its own achievements.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="mx-auto mt-4 grid w-full grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
                    {groupedAchievements.map((group) => {
                      if (group.unlocked.length === 0) {
                        return (
                          <Card key={group.itemKey}>
                            <CardHeader>
                              <CardTitle>{group.itemKey}</CardTitle>
                              <CardDescription>
                                0 achievements unlocked yet. Keep going!
                              </CardDescription>
                            </CardHeader>
                            <CardContent>
                              {group.nextThreshold ? (
                                <p>
                                  Next achievement unlocks at{" "}
                                  <strong>{group.nextThreshold}</strong> total
                                  times.
                                </p>
                              ) : (
                                <p>
                                  No more achievements to unlock for this item.
                                </p>
                              )}
                            </CardContent>
                          </Card>
                        );
                      }

                      const { highest, unlocked } = group;
                      return (
                        <Card key={group.itemKey}>
                          <CardHeader>
                            <CardTitle>{group.itemKey}</CardTitle>
                            <CardDescription>
                              {getUsageLabel(group.itemKey, group.count)} —
                              unlocked {unlocked.length} achievement
                              {unlocked.length > 1 ? "s" : ""}
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            {highest && (
                              <div className="flex flex-col items-center">
                                <span className="text-sm font-semibold">
                                  Highest Achievement
                                </span>
                                <FontAwesomeIconClient
                                  icon={highest.icon}
                                  size={64}
                                  className={`${highest.colorClass} animate-pulse`}
                                />
                                <p className="mt-1 text-sm font-medium">
                                  {highest.name}
                                </p>
                              </div>
                            )}
                            {group.nextThreshold && (
                              <p className="text-xs text-gray-500">
                                Next achievement unlocks at{" "}
                                <strong>{group.nextThreshold}</strong> total.
                                How many more do you need?
                              </p>
                            )}
                            <div className="mt-4 text-xs">
                              <p className="mb-2 font-semibold text-gray-500">
                                All Achievements Earned
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {unlocked.map((ach, index) => (
                                  <div
                                    key={`${ach.threshold}-${ach.created_date}-${index}`}
                                    className="flex items-center space-x-1 rounded border px-2 py-1"
                                  >
                                    <FontAwesomeIconClient
                                      icon={ach.icon}
                                      size={12}
                                      className={ach.colorClass}
                                    />
                                    <span>{ach.name}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </DialogContent>
              </DialogPortal>
            </Dialog>
            <div>
              <h3 className="text-base font-semibold">
                Your Top 5 Achievements
              </h3>
              <div className="mt-2 flex flex-col space-y-2">
                {topFive.map((ach, idx) => {
                  return (
                    <div
                      key={`${ach.threshold}-${ach.created_date}-${idx}`}
                      className="bg-background flex items-center space-x-3 rounded-md border p-2"
                    >
                      <FontAwesomeIconClient
                        icon={ach.icon}
                        size={32}
                        className={ach.colorClass}
                      />
                      <div className="flex flex-1 flex-col space-y-1">
                        <span className="font-medium">
                          {ach.name} (Threshold: {ach.threshold})
                        </span>
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          {ach.itemKey}
                        </span>
                        <div className="text-xs text-gray-500">
                          {getUsageLabel(ach.itemKey, ach.count)} —{" "}
                          {ach.nextThreshold
                            ? `Next achievement at ${ach.nextThreshold} total`
                            : "No more achievements left!"}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        ) : (
          <p>Keep going to unlock your first achievement!</p>
        )}
      </CardContent>
    </Card>
  );
}
