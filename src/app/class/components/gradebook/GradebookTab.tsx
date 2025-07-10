// src/app/(...)/GradebookTab.tsx
"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { GradedAssignmentOptions } from "@/app/api/queryOptions";
import LoaderSmallInline from "@/components/loaders/LoaderSmall";
import { Button } from "@/components/ui/button";
import type { Assignment } from "./GradedAssignmentsList";
import GradedAssignmentsList from "./GradedAssignmentsList";
import { CreateGradedAssignmentDialog } from "./CreateGradedAssignmentDialogFuck";
import { NotepadText, Scale, Tag } from "lucide-react";
import { CreateGradedSubjectDialog } from "./CreateGradedSubjectDialog";
import { CreateGradeScaleDialog } from "./CreateGradeScaleDialog";

interface GradebookTabProps {
  classId: string | null;
}

const GradebookTab: React.FC<GradebookTabProps> = ({ classId }) => {
  const { data, isLoading, error } = useQuery<Assignment[], Error>(
    GradedAssignmentOptions(classId),
  );

  if (isLoading) return <LoaderSmallInline />;
  if (error) {
    return <div className="text-red-600">Error: {error.message}</div>;
  }

  return (
    <div className="mb-5 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Gradebook</h2>
        <div className="space-x-2">
          <CreateGradeScaleDialog
            trigger={
              <Button variant="secondary">
                <Scale />{" "}
                <span className="hidden sm:block">Create Grade Scale</span>
              </Button>
            }
          />
          <CreateGradedSubjectDialog
            classId={classId ?? ""}
            assignments={data ?? []}
            trigger={
              <Button variant="secondary">
                <Tag />{" "}
                <span className="hidden sm:block">Create Graded Subject</span>
              </Button>
            }
          />
          <CreateGradedAssignmentDialog
            classId={classId ?? ""}
            trigger={
              <Button variant="default">
                <NotepadText />{" "}
                <span className="hidden sm:block">
                  Create Graded Assignment
                </span>
              </Button>
            }
          />
        </div>
      </div>

      {data && <GradedAssignmentsList assignments={data} classId={classId} />}
    </div>
  );
};

export default GradebookTab;
