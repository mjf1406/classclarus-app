import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { APP_NAME } from "@/lib/constants";
import { db } from "@/server/db";
import { eq } from "drizzle-orm";
import { students } from "@/server/db/schema";

export default async function GreetingCard({
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
  const studentName = student?.student_name_first_en;

  return (
    <div className="flex gap-2">
      <title>{`${studentName}'s Dashboard`}</title>
      {/* <Image  /> */}
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-3xl">Hey there, {studentName}!</CardTitle>
        </CardHeader>
        <CardContent>
          <p>
            Welcome to your {APP_NAME} Dashboard! Check out all the cards below
            to see what&apos;s going on.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
