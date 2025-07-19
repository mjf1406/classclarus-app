"use client";

import React, { useState, useCallback, useMemo } from "react";
import GroupsSelect from "@/components/selects/GroupSelect";
import RandomizerNameInput from "../components/RandomizerNameInput";
import SelectionModeRadio from "../components/SelectionModeRadio";
import AutoRemoveCheckbox from "../components/AutoRemoveCheckbox";
import { Button } from "@/components/ui/button";
import { Shuffle } from "lucide-react";

interface GroupTabProps {
  classId: string | null;
}

const GroupTab: React.FC<GroupTabProps> = ({ classId }) => {
  const [name, setName] = useState("");
  const [selectionMode, setSelectionMode] = useState("all-at-once");
  const [autoRemove, setAutoRemove] = useState(false);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);

  // Memoize stable empty array and no-op function for subgroups
  const emptySubgroups = useMemo(() => [], []);
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  const noOpSubgroupSelect = useCallback(() => {}, []);

  const handleGroupsSelect = useCallback((groups: string[]) => {
    setSelectedGroups(groups);
  }, []);

  const handleRandomizeGroup = useCallback(() => {
    console.log("Randomizing group with:", {
      name,
      selectionMode,
      autoRemove,
      selectedGroups,
    });
    // Add your randomization logic here
  }, [name, selectionMode, autoRemove, selectedGroups]);

  return (
    <div className="space-y-6">
      <p>Randomly select groups from within the class.</p>
      <RandomizerNameInput value={name} onChange={setName} />
      <SelectionModeRadio
        value={selectionMode}
        onValueChange={setSelectionMode}
      />
      {selectionMode === "one-by-one" && (
        <AutoRemoveCheckbox
          entityType="groups"
          checked={autoRemove}
          onCheckedChange={setAutoRemove}
        />
      )}
      <GroupsSelect
        classId={classId}
        selectedGroups={selectedGroups}
        onGroupsSelect={handleGroupsSelect}
        showSubgroups={false}
        selectedSubgroups={emptySubgroups}
        onSubgroupsSelect={noOpSubgroupSelect}
      />

      <Button size={"lg"} onClick={handleRandomizeGroup}>
        <Shuffle /> Shuffle Groups
      </Button>
    </div>
  );
};

export default GroupTab;
