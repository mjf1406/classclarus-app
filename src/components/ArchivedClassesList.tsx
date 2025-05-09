"use client";

import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  TeacherClassesOptions,
  type TeacherClassDetail,
} from "@/app/api/queryOptions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, AlertTriangle, CircleX } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { unarchiveClassById } from "@/app/class/actions/unarchiveClassById";
import { toast } from "sonner";

const ArchiveClassList: React.FC = () => {
  const queryClient = useQueryClient();

  const { data, isLoading, isError, error } = useQuery<TeacherClassDetail[]>(
    TeacherClassesOptions,
  );

  const unarchiveMutation = useMutation({
    mutationFn: (classId: string) => unarchiveClassById(classId),
    // Optimistically update the archived flag for the class
    onMutate: async (classId: string) => {
      await queryClient.cancelQueries({ queryKey: ["teacher-classes"] });
      const previousData = queryClient.getQueryData<TeacherClassDetail[]>([
        "teacher-classes",
      ]);
      queryClient.setQueryData<TeacherClassDetail[]>(
        ["teacher-classes"],
        (old) =>
          old?.map((cls) =>
            cls.classInfo.class_id === classId
              ? {
                  ...cls,
                  classInfo: { ...cls.classInfo, archived: false },
                }
              : cls,
          ) ?? [],
      );
      return { previousData };
    },
    onError: (err, classId, context) => {
      queryClient.setQueryData(["teacher-classes"], context?.previousData);
      toast.error("Failed to unarchive the class. Please try again.");
    },
    onSuccess: () => {
      toast.success("Class unarchived successfully.");
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["teacher-classes"] });
    },
  });

  if (isLoading) {
    return (
      <div className="m-auto flex w-full max-w-4xl items-center justify-center lg:min-w-3xl">
        <Loader2 className="h-24 w-24 animate-spin" />
      </div>
    );
  }

  if (isError || error) {
    return (
      <div className="m-auto flex h-auto w-full items-center justify-center">
        <div className="max-w-5xl px-4">
          <Alert
            variant="destructive"
            className="flex w-full items-center gap-4"
          >
            <CircleX
              className="shrink-0"
              style={{ width: "36px", height: "36px" }}
            />
            <div className="w-full">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error.message}</AlertDescription>
            </div>
          </Alert>
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="m-auto flex h-auto w-full items-center justify-center">
        <div className="max-w-5xl px-4">
          <Alert variant="warning" className="flex w-full items-center gap-4">
            <AlertTriangle
              className="shrink-0"
              style={{ width: "36px", height: "36px" }}
            />
            <div className="w-full">
              <AlertTitle>No Classes!</AlertTitle>
              <AlertDescription className="whitespace-nowrap">
                <p>
                  Please click the{" "}
                  <span className="border-destructive rounded-lg border px-2 py-0.5 font-bold">
                    <span className="text-xl">+</span> Add class
                  </span>{" "}
                  button at the top of the page to add a class.
                </p>
              </AlertDescription>
            </div>
          </Alert>
        </div>
      </div>
    );
  }

  // Filter out the classes that are archived
  const archivedClasses = data.filter((cls) => cls.classInfo.archived === true);

  const handleUnarchive = (classId: string) => {
    unarchiveMutation.mutate(classId);
  };

  return (
    <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
      {archivedClasses.map((item) => (
        <Card
          key={item.teacherAssignment.assignment_id}
          className="w-full gap-4 pt-2"
        >
          <CardHeader className="flex items-center justify-between rounded-t-xl">
            <CardTitle className="mx-auto flex h-12 w-full items-center justify-between gap-2 text-3xl font-bold">
              <div>
                <span>{item.classInfo.class_name}</span>{" "}
                <span className="text-xl">({item.classInfo.class_year})</span>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p>Unarchive this class to perform actions.</p>
          </CardContent>
          <div className="px-4">
            <Button
              variant="outline"
              className="dark:bg-background dark:border-foreground hover:dark:bg-primary/90 mx-auto w-full dark:border"
              disabled={unarchiveMutation.isPending}
              onClick={() => handleUnarchive(item.classInfo.class_id)}
            >
              {unarchiveMutation.isPending ? "Unarchiving..." : "Unarchive"}
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
};

export default ArchiveClassList;
