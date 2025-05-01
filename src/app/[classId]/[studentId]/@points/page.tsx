import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/server/db";
import { behaviors, points, reward_items } from "@/server/db/schema"; // Import students schema
import { eq } from "drizzle-orm";

export default async function GreetingCard({
  params,
}: {
  params: Promise<{ classId: string; studentId: string }>;
}) {
  const { classId, studentId } = await params;

  const pointsData = await db
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
    .where(eq(points.class_id, classId));

  return (
    <Card className="w-full">
      {" "}
      {/* Added w-full for better layout */}
      <CardHeader>
        <CardTitle>Points Data</CardTitle> {/* Updated title */}
      </CardHeader>
      <CardContent>
        {/* Display the pointsData JSON in a preformatted block */}
        <pre className="bg-muted max-h-96 overflow-auto rounded-md p-4">
          {" "}
          {/* Added styling for readability */}
          {JSON.stringify(pointsData.slice(0, 10), null, 2)}
        </pre>
      </CardContent>
    </Card>
  );
}
