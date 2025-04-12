// src/app/api/class-by-id/[classId]/route.ts
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { eq, and } from "drizzle-orm";
import {
  classes,
  teacher_classes,
  student_classes,
  student_groups,
  student_sub_groups,
  groups,
  sub_groups,
  reward_items,
  behaviors,
  absent_dates,
  points,
} from "@/server/db/schema";
import { db } from "@/server/db";
import type { Group, SubGroup } from "@/server/db/types";

export const revalidate = 360;
export const dynamic = "force-dynamic";
export const runtime = "edge";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const classId = searchParams.get("class_id")
  const { userId } = await auth();

  if (!classId) {
    return NextResponse.json(
      { error: "Missing 'class_id' search parameter." },
      { status: 400 }
    );
  }
  
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 1. Get teacher assignment and class details using the new classes schema.
    // Note that we now use classes.classId instead of classes.class_id.
    // const teacherAssignment = await db
    //   .select({
    //     teacherAssignment: teacher_classes,
    //     classInfo: classes,
    //   })
    //   .from(teacher_classes)
    //   .innerJoin(classes, eq(teacher_classes.class_id, classes.class_id))
    //   .where(
    //     and(
    //       eq(teacher_classes.user_id, userId),
    //       eq(teacher_classes.class_id, classId)
    //     )
    //   )
    //   .then((res) => res[0]);

    // if (!teacherAssignment) {
    //   return NextResponse.json(
    //     { error: "Class not found or unauthorized" },
    //     { status: 404 }
    //   );
    // }

    // 2. Launch all related queries in parallel filtered by classId.
    const studentClassesPromise = db
      .select()
      .from(student_classes)
      .where(eq(student_classes.class_id, classId));

    const groupsPromise = db
      .select()
      .from(groups)
      .where(eq(groups.class_id, classId));

    const subGroupsPromise = db
      .select()
      .from(sub_groups)
      .where(eq(sub_groups.class_id, classId));

    const rewardItemsPromise = db
      .select()
      .from(reward_items)
      .where(eq(reward_items.class_id, classId));

    const behaviorsPromise = db
      .select()
      .from(behaviors)
      .where(eq(behaviors.class_id, classId));

    const absentDatesPromise = db
      .select()
      .from(absent_dates)
      .where(eq(absent_dates.class_id, classId));

    // const pointsPromise = db
    //   .select()
    //   .from(points)
    //   .where(eq(points.class_id, classId));

    // For student_groups, check if we have any groups before constructing its query.
    const studentGroupsPromise = groupsPromise.then((groupsData: Group[]) => {
      if (!groupsData || groupsData.length === 0 || !groupsData[0]) {
        return [];
      }
      const groupId = groupsData[0].group_id;
      return db
        .select()
        .from(student_groups)
        .where(eq(student_groups.group_id, groupId));
    });

    // For student_sub_groups, do a similar check.
    const studentSubGroupsPromise = subGroupsPromise.then(
      (subGroupsData: SubGroup[]) => {
        if (!subGroupsData || subGroupsData.length === 0 || !subGroupsData[0]) {
          return [];
        }
        const subGroupId = subGroupsData[0].sub_group_id;
        return db
          .select()
          .from(student_sub_groups)
          .where(eq(student_sub_groups.sub_group_id, subGroupId));
      }
    );

    const [
      studentClasses,
      groupsData,
      subGroupsData,
      rewardItems,
      behaviorsData,
      absentDates,
      // pointsData,
      studentGroups,
      studentSubGroups,
    ] = await Promise.all([
      studentClassesPromise,
      groupsPromise,
      subGroupsPromise,
      rewardItemsPromise,
      behaviorsPromise,
      absentDatesPromise,
      // pointsPromise,
      studentGroupsPromise,
      studentSubGroupsPromise,
    ]);

    // 3. Build the final response structure.
    // The class details now come from teacherAssignment.classInfo which reflects the new schema.
    const classDetail = {
      // teacherAssignment,
      // classInfo: teacherAssignment.classInfo,
      studentClasses,
      groups: groupsData,
      subGroups: subGroupsData,
      rewardItems,
      behaviors: behaviorsData,
      absentDates,
      // points: pointsData,
      studentGroups,
      studentSubGroups,
    };

    return NextResponse.json(classDetail, { status: 200 });
  } catch (error) {
    console.error("Error fetching class data:", error);
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
