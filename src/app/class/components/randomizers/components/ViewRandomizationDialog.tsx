import React, { type ReactNode, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { ClassByIdOptions } from "@/app/api/queryOptions";
import { useUpdateRandomizationStudent } from "../hooks/useUpdateRandomizationStudent";
import type { RandomizationWithStudents } from "@/server/db/schema";
import { cn } from "@/lib/utils";

interface ViewRandomizationDialogProps {
  trigger: ReactNode;
  randomization: RandomizationWithStudents;
  classId: string;
}

export function ViewRandomizationDialog({
  trigger,
  randomization,
  classId,
}: ViewRandomizationDialogProps) {
  const { data: classData } = useQuery(ClassByIdOptions(classId));
  const studentInfo = classData?.studentInfo ?? [];

  const { mutate: updateStudent } = useUpdateRandomizationStudent(classId);

  const handleToggleCheck = useCallback(
    (studentRandomizationId: string, studentId: string, checked: boolean) => {
      updateStudent({
        id: studentRandomizationId,
        student_id: studentId,
        checked,
      });
    },
    [updateStudent],
  );

  const sorted = [...randomization.students].sort(
    (a, b) => a.position - b.position,
  );

  const studentsWithDetails = sorted.map((s) => ({
    ...s,
    studentDetail: studentInfo.find((si) => si.student_id === s.student_id),
  }));

  const total = studentsWithDetails.length;
  const completed = studentsWithDetails.filter((s) => s.checked).length;
  const progressValue = total > 0 ? (completed / total) * 100 : 0;

  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="h-full max-h-[calc(100dvh)] w-full min-w-[calc(100dvw)] content-start overflow-auto p-6">
        <DialogHeader className="flex items-center justify-between pb-4">
          <div>
            <DialogTitle className="text-5xl font-bold">
              {randomization.name}
            </DialogTitle>
            <DialogDescription
              asChild
              className="text-muted-foreground mt-2 text-center text-2xl"
            >
              <div className="flex flex-col gap-4">
                <div className="text-muted-foreground flex w-full flex-col items-center justify-center text-center text-sm">
                  <span>Created: {randomization.created_date}</span>
                  <span>Updated: {randomization.updated_date}</span>
                </div>
              </div>
            </DialogDescription>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1">
          <div className="mb-10 flex w-full flex-col items-center justify-center">
            <span className="w-full text-center text-2xl font-semibold">
              {completed} of {total} completed
            </span>
            <Progress value={progressValue} className="mt-2 h-4 w-full" />
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {studentsWithDetails.map((student) => (
              <Card
                key={student.id}
                className={cn(
                  "transition-all duration-200",
                  student.checked ? "opacity-50" : "shadow-sm hover:shadow-md",
                )}
              >
                <CardContent>
                  <div className="flex items-center space-x-4">
                    <span className="bg-secondary inline-flex h-12 w-12 items-center justify-center rounded-full text-xl font-bold">
                      {student.position}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center space-x-3">
                        <Checkbox
                          id={`student-${student.id}`}
                          checked={student.checked}
                          onCheckedChange={(c) =>
                            handleToggleCheck(
                              student.id,
                              student.student_id,
                              Boolean(c),
                            )
                          }
                          className="h-6 w-6"
                        />
                        <Label
                          htmlFor={`student-${student.id}`}
                          className="cursor-pointer text-2xl font-semibold"
                        >
                          {student.studentDetail
                            ? `${student.studentDetail.student_name_first_en} ${student.studentDetail.student_name_last_en}`
                            : "Unknown Student"}
                        </Label>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>

        <DialogFooter>
          <DialogClose asChild>
            <button className="btn">Close</button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
