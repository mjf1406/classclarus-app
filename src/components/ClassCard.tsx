"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { TeacherClassDetail } from "@/app/api/queryOptions";
import { Crown, User } from "lucide-react";
import { Button } from "./ui/button";
import Link from "next/link";
import ClassActionMenu from "@/app/class/components/ClassActionMenu";

interface ClassCardProps {
  detail: TeacherClassDetail;
}

const ClassCard: React.FC<ClassCardProps> = ({ detail }) => {
  const { teacherAssignment, classInfo } = detail;

  // Choose the icon based on the teacher's role.
  const roleIcon =
    teacherAssignment.role?.toLowerCase() === "primary" ? (
      <Crown size={16} className="mr-1 inline-block" />
    ) : (
      <User size={16} className="mr-1 inline-block" />
    );

  return (
    <Card className="w-full gap-4 pt-2">
      <CardHeader className="flex items-center justify-between rounded-t-xl">
        <CardTitle className="mx-auto flex h-12 w-full items-center justify-between gap-2 text-3xl font-bold">
          <div>
            <span>{classInfo.class_name}</span>{" "}
            <span className="text-xl">({classInfo.class_year})</span>
          </div>
          <ClassActionMenu
            classId={classInfo.class_id}
            className="dark:bg-background dark:hover:bg-accent dark:text-white"
          />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p>
          <strong>Language:</strong> {classInfo.class_language}
        </p>
        <p>
          <strong>Grade:</strong> {classInfo.class_grade}
        </p>
        <p>
          <strong>Class Code:</strong> {classInfo.class_code}
        </p>
        <p>
          <strong>Role:</strong> {roleIcon}
          {teacherAssignment.role}
        </p>
        <p>
          <strong>Assigned Date:</strong>{" "}
          {new Date(teacherAssignment.assigned_date).toLocaleDateString()}
        </p>
      </CardContent>
      <div className="px-4">
        <Link href={`/class?class_id=${classInfo.class_id}&tab=points`}>
          <Button
            variant={"outline"}
            className="dark:bg-background dark:border-foreground hover:dark:bg-primary/90 mx-auto w-full dark:border"
          >
            Open
          </Button>
        </Link>
      </div>
    </Card>
  );
};

export default ClassCard;
