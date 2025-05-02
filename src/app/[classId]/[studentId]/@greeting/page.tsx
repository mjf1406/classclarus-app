import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { APP_NAME } from "@/lib/constants";
import { db } from "@/server/db";
import { eq } from "drizzle-orm";
import { students } from "@/server/db/schema";
import { StudentImage } from "../components/StudentImage";

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

  // Array of cool adjectives
  const adjectives = [
    "Amazing",
    "Astounding",
    "Brilliant",
    "Dynamic",
    "Electrifying",
    "Energetic",
    "Engaging",
    "Exceptional",
    "Exciting",
    "Explosive",
    "Fascinating",
    "Fierce",
    "Groundbreaking",
    "Heroic",
    "Impressive",
    "Incredible",
    "Innovative",
    "Inspiring",
    "Legendary",
    "Phenomenal",
    "Powerful",
    "Revolutionary",
    "Spectacular",
    "Thrilling",
    "Transformative",
    "Vigorous",
    "Vibrant",
    "Visionary",
    "Wondrous",
  ];

  // Randomly pick one adjective
  const randomIndex = Math.floor(Math.random() * adjectives.length);
  const randomAdjective = adjectives[randomIndex];

  // Prepend the adjective to the student's name
  const displayName = studentName ? `${randomAdjective} ${studentName}` : "";

  return (
    <div className="grid w-full grid-cols-6 gap-2">
      <title>{`${studentName}'s Dashboard`}</title>
      <div className="col-span-2 flex items-center justify-center">
        <StudentImage />
      </div>
      <Card className="col-span-4 w-full">
        <CardHeader>
          <CardTitle className="text-3xl">Hey there, {displayName}!</CardTitle>
        </CardHeader>
        <CardContent>
          <p>
            Welcome to your {APP_NAME} Dashboard! Check out all the cards below
            to see what&apos;s going on.
          </p>
          <br />
          <p>
            Got an idea or two to make your dashboard better? Tell me! I would
            love to hear it and give you points for your super smart brain idea
            boom boom banana awesomeness!!!!
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
