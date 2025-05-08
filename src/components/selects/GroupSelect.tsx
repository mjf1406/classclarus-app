"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ClassByIdOptions } from "@/app/api/queryOptions";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

export type GroupType = {
  group_id: string;
  group_name: string;
};

export type GroupsSelectProps = {
  classId: string | null;
  onGroupsSelect: (selectedGroups: string[]) => void;
};

export default function GroupsSelect({
  classId,
  onGroupsSelect,
}: GroupsSelectProps) {
  // Local state to hold the selected group IDs.
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);

  // Use query to fetch class details, including its groups.
  const { data, isLoading, error } = useQuery(ClassByIdOptions(classId));

  if (isLoading) {
    return <div>Loading groups...</div>;
  }

  if (error) {
    return (
      <div>
        Error loading groups:{" "}
        {error instanceof Error ? error.message : "An unknown error occurred"}
      </div>
    );
  }

  // Adjust the groups extraction depending on your API structure.
  // If your API returns a single object with groups on it:
  const groups: GroupType[] = data?.groups ?? [];
  // If your API returns an array and you need the first element’s groups, use:
  // const groups: GroupType[] = data && data.length > 0 ? data[0].groups : [];

  // Toggle the checkbox state for a group and immediately notify the parent.
  const handleToggle = (groupId: string) => {
    setSelectedGroups((prev) => {
      const newGroups = prev.includes(groupId)
        ? prev.filter((id) => id !== groupId)
        : [...prev, groupId];
      onGroupsSelect(newGroups);
      return newGroups;
    });
  };

  return (
    <div className="flex gap-5">
      {groups.map((group) => (
        <div
          key={group.group_id}
          className="flex cursor-pointer items-center space-x-2"
        >
          <Checkbox
            id={group.group_id}
            checked={selectedGroups.includes(group.group_id)}
            onCheckedChange={(checked) => {
              // onCheckedChange sends either true/false or an array sometimes,
              // so make sure to test its behavior in your environment.
              if (checked === true) {
                handleToggle(group.group_id);
              } else if (checked === false) {
                handleToggle(group.group_id);
              }
            }}
          />
          <Label htmlFor={group.group_id}>{group.group_name}</Label>
        </div>
      ))}
    </div>
  );
}
