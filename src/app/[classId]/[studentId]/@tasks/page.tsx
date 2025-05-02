import React from "react";
import { db } from "@/server/db";
import { assignments, student_assignments } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import TasksTableClient, {
  type Assignment,
} from "../components/TasksTableClient";

export default async function TasksCard({
  params,
}: {
  params: Promise<{ classId: string; studentId: string }>;
}) {
  const { classId, studentId } = await params;

  // Drizzle query joins student_assignments and assignments, filtering by class and student.
  const data: Assignment[] = await db
    .select({
      sa_id: student_assignments.id,
      sa_user_id: student_assignments.user_id,
      sa_class_id: student_assignments.class_id,
      sa_student_id: student_assignments.student_id,
      sa_assignment_id: student_assignments.assignment_id,
      sa_complete: student_assignments?.complete ?? false,
      sa_completed_ts: student_assignments.completed_ts,
      assignment_name: assignments.name,
      assignment_description: assignments.description,
      assignment_data: assignments.data,
      due_date: assignments.due_date,
      topic: assignments.topic,
      working_date: assignments.working_date,
      created_date: assignments.created_date,
      updated_date: assignments.updated_date,
    })
    .from(student_assignments)
    .innerJoin(
      assignments,
      eq(student_assignments.assignment_id, assignments.id),
    )
    .where(
      and(
        eq(student_assignments.student_id, studentId),
        eq(student_assignments.class_id, classId),
      ),
    );

  return <TasksTableClient assignments={data} />;
}
