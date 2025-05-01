import { db } from "@/server/db";
import { eq } from "drizzle-orm";
import { students } from "@/server/db/schema";
import { Button } from "@/components/ui/button";

export default async function StudentDashboard({
  params,
}: {
  params: Promise<{ classId: string; studentId: string }>;
}) {
  const { classId, studentId } = await params;

  const studentsArray = await db
    .select()
    .from(students)
    .where(eq(students.student_id, studentId))
    .limit(1);
  const student = studentsArray[0];

  return (
    <div>
      <title>{`${student?.student_name_first_en}'s Dashboard`}</title>
      <div className="flex gap-2 pt-5">
        <Button>Default</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="destructive">Destructive</Button>
        <Button variant="outline">Outline</Button>
      </div>
    </div>
  );
}
