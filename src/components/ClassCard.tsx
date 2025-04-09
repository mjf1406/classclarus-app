"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { TeacherClassDetail } from "@/app/api/queryOptions";
import { Crown, User } from "lucide-react";
import { Button } from "./ui/button";

interface ClassCardProps {
  detail: TeacherClassDetail;
}

const ClassCard: React.FC<ClassCardProps> = ({ detail }) => {
  const router = useRouter();
  const { teacherAssignment, classInfo } = detail;

  // Choose the icon based on the teacher's role.
  const roleIcon =
    teacherAssignment.role?.toLowerCase() === "primary" ? (
      <Crown size={16} className="mr-1 inline-block" />
    ) : (
      <User size={16} className="mr-1 inline-block" />
    );

  const handleOpen = () => {
    router.push(`/${classInfo.class_id}`);
  };

  return (
    <Card className="pt-0">
      <CardHeader className="bg-accent flex items-center justify-between rounded-t-xl">
        <CardTitle className="flex h-12 items-center justify-center gap-2 text-2xl font-bold">
          <span>{classInfo.class_name}</span>{" "}
          <span className="text-lg">({classInfo.class_year})</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p>
          <strong>Language:</strong> {classInfo.class_language} |{" "}
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
        <Button
          variant={"outline"}
          className="bg-background dark:bg-background mx-auto w-full"
          onClick={handleOpen}
        >
          Open
        </Button>
      </div>
    </Card>
  );
};

export default ClassCard;
