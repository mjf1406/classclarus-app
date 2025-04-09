// components/ClassList.tsx
"use client";

import React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  TeacherClassesOptions,
  type TeacherClassDetail,
} from "@/app/api/queryOptions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";

const ClassList: React.FC = () => {
  const { data, isLoading, isError, error } = useQuery<TeacherClassDetail[]>(
    TeacherClassesOptions,
  );

  if (isLoading) {
    return (
      <div className="m-auto flex w-full items-center justify-center">
        <Loader2 className="h-24 w-24 animate-spin" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="m-auto flex h-auto w-full items-center justify-center">
        <div className="max-w-4xl">
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error.message}</AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="m-auto flex h-auto w-full items-center justify-center">
        <div className="max-w-4xl">
          <Alert variant="destructive">
            <AlertTitle>No Classes Found</AlertTitle>
            <AlertDescription>No classes available.</AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-4">
      {data.map((item) => {
        const { teacherAssignment, classInfo } = item;
        return (
          <Link
            key={teacherAssignment.assignment_id}
            href={`/${classInfo.class_id}`}
            className="cursor-pointer"
          >
            <Card>
              <CardHeader>
                <CardTitle>{classInfo.class_name}</CardTitle>
              </CardHeader>
              <CardContent>
                <p>
                  Language: {classInfo.class_language} | Grade:{" "}
                  {classInfo.class_grade}
                </p>
                <p>Class Code: {classInfo.class_code}</p>
                <p>Role: {teacherAssignment.role}</p>
                <p>
                  Assigned Date:{" "}
                  {new Date(
                    teacherAssignment.assigned_date,
                  ).toLocaleDateString()}
                </p>
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </div>
  );
};

export default ClassList;
