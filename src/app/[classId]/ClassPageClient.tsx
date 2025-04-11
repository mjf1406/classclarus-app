"use client";

import { useQuery } from "@tanstack/react-query";
import React from "react";
import { ClassByIdOptions } from "../api/queryOptions";
import { Loader2 } from "lucide-react";

interface ClassPageClientProps {
  classId: string;
}

export function ClassPageClient({ classId }: ClassPageClientProps) {
  const { data, error, isLoading } = useQuery(ClassByIdOptions(classId));

  if (isLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <Loader2 className="h-24 w-24 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-5 py-3 text-red-500">
        {error instanceof Error ? error.message : "Error occurred"}
      </div>
    );
  }

  return (
    <div className="px-5 py-3">
      <h1 className="text-3xl font-bold">
        {data?.classInfo.class_name} ({data?.classInfo.class_year})
      </h1>
    </div>
  );
}
