import React from "react";
import { db } from "@/server/db";
import { behaviors, points, reward_items } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import type { PointClient } from "../components/PointsCardClient";
import PointsCardClient from "../components/PointsCardClient";

export default async function PointsCard({
  params,
}: {
  params: Promise<{ classId: string; studentId: string }>;
}) {
  const { classId, studentId } = await params;

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

  // Map/transform the fetched data to the type expected by the client component.
  const pointsData: PointClient[] = data.map((point) => ({
    id: point.id,
    type: point.type,
    number_of_points: point.number_of_points,
    created_date: point.created_date,
    behavior_name: point.behavior_name ?? point.behavior_title ?? null,
    reward_item_name: point.reward_item_name ?? point.reward_title ?? null,
  }));

  return <PointsCardClient pointsData={pointsData} />;
}
