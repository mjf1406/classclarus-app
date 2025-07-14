// src/app/(...)/GradebookTab.tsx
"use client";

import React from "react";
import { TbReport } from "react-icons/tb";
import { useQuery } from "@tanstack/react-query";
import { GradedAssignmentOptions, ReportOptions } from "@/app/api/queryOptions";
import LoaderSmallInline from "@/components/loaders/LoaderSmall";
import { Button } from "@/components/ui/button";
import { NotepadText, Scale, Tag } from "lucide-react";
import { GradedSubjectManagerDialog } from "./graded-assignments/GradedSubjectManager";
import type { Assignment } from "./graded-assignments/GradedAssignmentsList";
import { GradeScaleManagerDialog } from "./grade-scales/GradeScaleManager";
import { CreateGradedAssignmentDialog } from "./graded-assignments/CreateGradedAssignmentDialogFuck";
import GradedAssignmentsList from "./graded-assignments/GradedAssignmentsList";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CreateReportDialog } from "./reports/CreateReportDialog";
import ReportsList from "./reports/ReportsList";

interface GradebookTabProps {
  classId: string | null;
}

const GradebookTab: React.FC<GradebookTabProps> = ({ classId }) => {
  const { data, isLoading, error } = useQuery<Assignment[], Error>(
    GradedAssignmentOptions(classId),
  );
  const {
    data: reports,
    isLoading: reportsIsLoading,
    error: reportsError,
  } = useQuery(ReportOptions(classId));

  if (isLoading) return <LoaderSmallInline />;
  if (error) {
    return <div className="text-red-600">Error: {error.message}</div>;
  }

  return (
    <div className="mb-5 space-y-2">
      <h2 className="block text-2xl font-semibold lg:hidden">Gradebook</h2>
      <Tabs defaultValue="assignments">
        <TabsList>
          <TabsTrigger value="assignments">Assignments</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>
        <TabsContent value="assignments" className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="space-x-2">
              <GradeScaleManagerDialog
                trigger={
                  <Button variant="outline">
                    <Scale />
                    <span className="hidden md:block">Grade Scales</span>
                  </Button>
                }
              />
              <GradedSubjectManagerDialog
                classId={classId ?? ""}
                assignments={data ?? []}
                trigger={
                  <Button variant="outline">
                    <Tag />{" "}
                    <span className="hidden md:block">Graded Subjects</span>
                  </Button>
                }
              />
              <CreateGradedAssignmentDialog
                classId={classId ?? ""}
                trigger={
                  <Button variant="default">
                    <NotepadText />{" "}
                    <span className="hidden md:block">
                      Create Graded Assignment
                    </span>
                  </Button>
                }
              />
            </div>
          </div>

          {data && (
            <GradedAssignmentsList assignments={data} classId={classId} />
          )}
        </TabsContent>
        <TabsContent value="reports" className="space-y-2">
          <div className="space-x-2">
            <GradeScaleManagerDialog
              trigger={
                <Button variant="outline">
                  <Scale />
                  <span className="hidden md:block">Grade Scales</span>
                </Button>
              }
            />
            <GradedSubjectManagerDialog
              classId={classId ?? ""}
              assignments={data ?? []}
              trigger={
                <Button variant="outline">
                  <Tag />{" "}
                  <span className="hidden md:block">Graded Subjects</span>
                </Button>
              }
            />
            <CreateReportDialog
              classId={classId ?? ""}
              trigger={
                <Button variant="default">
                  <TbReport />
                  <span className="hidden md:block">Create Report</span>
                </Button>
              }
            />
          </div>
          <ReportsList classId={classId} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default GradebookTab;
