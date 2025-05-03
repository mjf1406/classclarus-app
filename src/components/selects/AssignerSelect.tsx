"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AssignersOptions } from "@/app/api/queryOptions";

type AssignersSelectProps = {
  value: string;
  onValueChange: (value: string) => void;
  classId: string | null;
};

export default function AssignersSelect({
  value,
  onValueChange,
  classId,
}: AssignersSelectProps) {
  const { data, isLoading, error } = useQuery(AssignersOptions(classId));

  if (isLoading) return <div>Loading assigners...</div>;
  if (error) {
    return (
      <div>
        Error loading assigners: {error instanceof Error ? error.message : ""}
      </div>
    );
  }

  // Filter assigners with type "random"
  const filteredAssigners =
    data?.filter((item) => item.assigner_type === "random") ?? [];

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder="Select an assigner" />
      </SelectTrigger>
      <SelectContent>
        {filteredAssigners.map((item) => (
          <SelectItem key={item.assigner_id} value={item.assigner_id}>
            {item.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
