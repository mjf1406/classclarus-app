"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  TeacherClassesOptions,
  type TeacherClassDetail,
} from "@/app/api/queryOptions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ClassesSelectProps = {
  value: string;
  onValueChange: (value: string) => void;
};

export default function ClassesSelect({
  value,
  onValueChange,
}: ClassesSelectProps) {
  const { data, isLoading, isError, error } = useQuery<TeacherClassDetail[]>(
    TeacherClassesOptions,
  );

  if (isLoading) {
    return <div>Loading classes...</div>;
  }

  if (isError) {
    return (
      <div>
        Error loading classes: {error instanceof Error ? error.message : ""}
      </div>
    );
  }

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder="Select a class" />
      </SelectTrigger>
      <SelectContent>
        {data?.map((item) => (
          <SelectItem
            key={item.classInfo.class_id}
            value={item.classInfo.class_id}
          >
            {item.classInfo.class_name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
