// src/app/(...)/GradebookTab.tsx
"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { GradedAssignmentOptions } from "@/app/api/queryOptions";
import LoaderSmallInline from "@/components/loaders/LoaderSmall";
import { CreateGradedAssignmentDialog } from "./CreateGradedAssignmentDIalog";
import { Button } from "@/components/ui/button";
import type { Assignment } from "./GradedAssignmentsList";
import GradedAssignmentsList from "./GradedAssignmentsList";

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
        <CreateGradedAssignmentDialog
          classId={classId ?? ""}
          trigger={
            <Button variant="secondary">Create Graded Assignment</Button>
          }
        />
      </div>

      {data && <GradedAssignmentsList assignments={data} />}
    </div>
  );
};

export default GradebookTab;
