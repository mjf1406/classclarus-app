// File: GlowsAndGrowsCard.tsx

import React from "react";
import {
  Card,
  CardHeader,
  CardDescription,
  CardTitle,
} from "@/components/ui/card";
import { db } from "@/server/db";
import { behaviors, points } from "@/server/db/schema";
import { eq, and, sql } from "drizzle-orm";
import StudentBehaviorLeadersCard from "../components/StudentBehaviorLeadersCard";

interface BehaviorAggregate {
  behavior: string;
  type: "positive" | "negative";
  totalPoints: number;
  otherStudentsCount?: number;
  title: string | null | undefined;
}

// Define a type for the aggregate query rows.
interface AggregateRow {
  behavior_id: string | null;
  student_id: string;
  totalPoints: number;
  behavior: string;
  title: string | null;
}

export default async function GlowsAndGrowsCard({
  params,
}: {
  params: Promise<{ classId: string; studentId: string }>;
}) {
  const { classId, studentId } = await params;

  // --- Aggregation query for positive behaviors ("Glows") ---
  const positiveAggregates: AggregateRow[] = await db
    .select({
      behavior_id: points.behavior_id,
      student_id: points.student_id,
      totalPoints: sql<number>`sum(${points.number_of_points})`,
      behavior: behaviors.name,
      title: behaviors.title,
    })
    .from(points)
    .innerJoin(behaviors, eq(behaviors.behavior_id, points.behavior_id))
    .where(and(eq(points.class_id, classId), eq(points.type, "positive")))
    .groupBy(
      points.behavior_id,
      points.student_id,
      behaviors.name,
      behaviors.title,
    );

  // --- Aggregation query for negative behaviors ("Grows") ---
  const negativeAggregates: AggregateRow[] = await db
    .select({
      behavior_id: points.behavior_id,
      student_id: points.student_id,
      totalPoints: sql<number>`sum(${points.number_of_points})`,
      behavior: behaviors.name,
      title: behaviors.title,
    })
    .from(points)
    .innerJoin(behaviors, eq(behaviors.behavior_id, points.behavior_id))
    .where(and(eq(points.class_id, classId), eq(points.type, "negative")))
    .groupBy(
      points.behavior_id,
      points.student_id,
      behaviors.name,
      behaviors.title,
    );

  // Optional: Filter out aggregate rows where behavior_id is null.
  const filteredPositive: AggregateRow[] = positiveAggregates.filter(
    (agg): agg is AggregateRow => agg.behavior_id !== null,
  );
  const filteredNegative: AggregateRow[] = negativeAggregates.filter(
    (agg): agg is AggregateRow => agg.behavior_id !== null,
  );

  // Helper to group by behavior and pick the top entry for the current student.
  function getTopAggregates(aggregates: AggregateRow[]): BehaviorAggregate[] {
    // Group aggregates by behavior_id.
    const groups: Record<string, AggregateRow[]> = {};
    for (const agg of aggregates) {
      // Even though filtered arrays should only contain non-null behavior_id,
      // we add an extra check here to satisfy TypeScript.
      if (agg.behavior_id === null) continue;
      const bid = agg.behavior_id;
      groups[bid] = groups[bid] ?? [];
      groups[bid].push(agg);
    }

    const topList: BehaviorAggregate[] = [];
    for (const group of Object.values(groups)) {
      // Find the maximum totalPoints for that behavior.
      const maxPoints = Math.max(...group.map((g) => Number(g.totalPoints)));
      // Filter only those entries that have the max points.
      const topEntries = group.filter(
        (g) => Number(g.totalPoints) === maxPoints,
      );
      // Check if the current student is among the top entries.
      const studentEntry = topEntries.find((g) => g.student_id === studentId);
      if (studentEntry) {
        const othersCount = topEntries.length - 1; // count of other students sharing the top score
        topList.push({
          behavior: studentEntry.behavior,
          type: "positive",
          totalPoints: Number(studentEntry.totalPoints),
          otherStudentsCount: othersCount,
          title: studentEntry.title,
        });
      }
    }
    return topList;
  }

  const topPositive: BehaviorAggregate[] = getTopAggregates(filteredPositive);
  const topNegative: BehaviorAggregate[] = getTopAggregates(filteredNegative);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Glows and Grows</CardTitle>
        <CardDescription>
          Take a look at all the behaviors where you&apos;re number one in the
          whole class! Careful! It&apos;s not so good to be #1 for negative
          behaviors.
        </CardDescription>
      </CardHeader>
      <StudentBehaviorLeadersCard
        topPositive={topPositive}
        topNegative={topNegative}
      />
    </Card>
  );
}
