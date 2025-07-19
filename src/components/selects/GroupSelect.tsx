"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { ClassByIdOptions } from "@/app/api/queryOptions";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { Group, SubGroup } from "@/server/db/types";

export type GroupsSelectProps = {
  classId: string | null;
  selectedGroups: string[];
  onGroupsSelect: (selectedGroups: string[]) => void;
  showSubgroups?: boolean;
  selectedSubgroups?: string[];
  onSubgroupsSelect?: (selectedSubgroups: string[]) => void;
};

export default function GroupsSelect({
  classId,
  selectedGroups,
  onGroupsSelect,
  showSubgroups = false,
  selectedSubgroups = [],
  onSubgroupsSelect,
}: GroupsSelectProps) {
  const [internalSelectedSubgroups, setInternalSelectedSubgroups] =
    useState<string[]>(selectedSubgroups);
  const previousSelectedGroups = useRef<string[]>([]);

  // Use query to fetch class details, including its groups and subgroups.
  const { data, isLoading, error } = useQuery(ClassByIdOptions(classId));

  // Update internal state when prop changes
  useEffect(() => {
    setInternalSelectedSubgroups(selectedSubgroups);
  }, [selectedSubgroups]);

  // Handle subgroup selection when groups change - ONLY when showSubgroups is true
  useEffect(() => {
    if (!showSubgroups || !data) {
      previousSelectedGroups.current = [...selectedGroups];
      return;
    }

    const subgroups: SubGroup[] = data?.subGroups ?? [];

    // Find newly added and removed groups
    const addedGroups = selectedGroups.filter(
      (groupId) => !previousSelectedGroups.current.includes(groupId),
    );
    const removedGroups = previousSelectedGroups.current.filter(
      (groupId) => !selectedGroups.includes(groupId),
    );

    // Only proceed if there are actual changes to groups
    if (addedGroups.length === 0 && removedGroups.length === 0) {
      return;
    }

    let newSelectedSubgroups = [...internalSelectedSubgroups];

    // Remove subgroups belonging to removed groups
    if (removedGroups.length > 0) {
      newSelectedSubgroups = newSelectedSubgroups.filter((subgroupId) => {
        const subgroup = subgroups.find((sg) => sg.sub_group_id === subgroupId);
        return !subgroup || !removedGroups.includes(subgroup.group_id);
      });
    }

    // Add subgroups belonging to newly added groups
    if (addedGroups.length > 0) {
      const newSubgroupsToAdd = subgroups
        .filter((subgroup) => addedGroups.includes(subgroup.group_id))
        .map((subgroup) => subgroup.sub_group_id)
        .filter((subgroupId) => !newSelectedSubgroups.includes(subgroupId));

      newSelectedSubgroups = [...newSelectedSubgroups, ...newSubgroupsToAdd];
    }

    // Update state if there are changes
    if (
      newSelectedSubgroups.length !== internalSelectedSubgroups.length ||
      !newSelectedSubgroups.every((id) =>
        internalSelectedSubgroups.includes(id),
      )
    ) {
      setInternalSelectedSubgroups(newSelectedSubgroups);
      onSubgroupsSelect?.(newSelectedSubgroups);
    }

    // Update the previous selected groups reference
    previousSelectedGroups.current = [...selectedGroups];
  }, [selectedGroups, showSubgroups, data, onSubgroupsSelect]); // Removed internalSelectedSubgroups

  // Memoize handlers to prevent unnecessary re-renders
  const handleGroupToggle = useCallback(
    (groupId: string) => {
      const newGroups = selectedGroups.includes(groupId)
        ? selectedGroups.filter((id) => id !== groupId)
        : [...selectedGroups, groupId];
      onGroupsSelect(newGroups);
    },
    [selectedGroups, onGroupsSelect],
  );

  const handleSubgroupToggle = useCallback(
    (subgroupId: string) => {
      const newSubgroups = internalSelectedSubgroups.includes(subgroupId)
        ? internalSelectedSubgroups.filter((id) => id !== subgroupId)
        : [...internalSelectedSubgroups, subgroupId];

      setInternalSelectedSubgroups(newSubgroups);
      onSubgroupsSelect?.(newSubgroups);
    },
    [internalSelectedSubgroups, onSubgroupsSelect],
  );

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

  const groups: Group[] = data?.groups ?? [];

  // Early return for groups-only mode
  if (!showSubgroups) {
    return (
      <div className="max-w-lg space-y-4">
        <div className="space-y-2">
          <Label>Select Group(s)</Label>
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
                    if (checked === true || checked === false) {
                      handleGroupToggle(group.group_id);
                    }
                  }}
                />
                <Label htmlFor={group.group_id}>{group.group_name}</Label>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const subgroups: SubGroup[] = data?.subGroups ?? [];

  // Filter subgroups based on selected groups
  const availableSubgroups = subgroups.filter((subgroup) =>
    selectedGroups.includes(subgroup.group_id),
  );

  return (
    <div className="max-w-lg space-y-4">
      {/* Groups Selection */}
      <div className="space-y-2">
        <Label>Select Group(s)</Label>
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
                  if (checked === true || checked === false) {
                    handleGroupToggle(group.group_id);
                  }
                }}
              />
              <Label htmlFor={group.group_id}>{group.group_name}</Label>
            </div>
          ))}
        </div>
      </div>

      {/* Subgroups Selection */}
      {selectedGroups.length > 0 && (
        <div className="space-y-2">
          <Label>Select Subgroup(s)</Label>
          {availableSubgroups.length > 0 ? (
            <div className="flex gap-5">
              {availableSubgroups.map((subgroup) => (
                <div
                  key={subgroup.sub_group_id}
                  className="flex cursor-pointer items-center space-x-2"
                >
                  <Checkbox
                    id={subgroup.sub_group_id}
                    checked={internalSelectedSubgroups.includes(
                      subgroup.sub_group_id,
                    )}
                    onCheckedChange={(checked) => {
                      if (checked === true || checked === false) {
                        handleSubgroupToggle(subgroup.sub_group_id);
                      }
                    }}
                  />
                  <Label htmlFor={subgroup.sub_group_id}>
                    {subgroup.sub_group_name}
                  </Label>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              No subgroups available for selected groups.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
