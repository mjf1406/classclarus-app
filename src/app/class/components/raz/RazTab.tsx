"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { ClassByIdOptions } from "@/app/api/queryOptions";
import CreateRecordDialog from "./components/CreateRecordDialog";
import RazTable from "./components/RazTable";

interface RazTabProps {
  classId: string | null;
}

const RazTab: React.FC<RazTabProps> = ({ classId }) => {
  // Fetch class data using the provided classId.
  const { data, error, isLoading } = useQuery(ClassByIdOptions(classId));

  if (isLoading) {
    return <p>Loading class data...</p>;
  }

  if (error || !data) {
    return <p>Error loading class data.</p>;
  } 

  const { studentInfo, raz } = data;

  return (
    <div className="flex flex-col gap-3 pb-10">
      <CreateRecordDialog
        defaultClassId={classId ?? undefined}
        studentInfo={studentInfo}
      />
      <RazTable raz={raz} studentInfo={studentInfo} />
    </div>
  );
};

export default RazTab;
