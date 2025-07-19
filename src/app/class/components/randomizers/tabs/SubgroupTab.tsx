"use client";

import React, { useState } from "react";
import GroupsSelect from "@/components/selects/GroupSelect";
import RandomizerNameInput from "../components/RandomizerNameInput";
import SelectionModeRadio from "../components/SelectionModeRadio";
import AutoRemoveCheckbox from "../components/AutoRemoveCheckbox";
import { Button } from "@/components/ui/button";
import { Shuffle } from "lucide-react";

interface SubgroupTabProps {
  classId: string | null;
}

const SubgroupTab: React.FC<SubgroupTabProps> = ({ classId }) => {
  const [name, setName] = useState("");
  const [selectionMode, setSelectionMode] = useState("all-at-once");
  const [autoRemove, setAutoRemove] = useState(false);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [selectedSubgroups, setSelectedSubgroups] = useState<string[]>([]);

  const handleRandomizeSubgroup = () => {
    console.log("Randomizing subgroup with:", {
      name,
      selectionMode,
      autoRemove,
      selectedGroups,
      selectedSubgroups,
    });
    // Add your randomization logic here
  };

  return (
    <div className="space-y-6">
      <p>
        Randomly select subgroups from within the whole class or in certain
        group(s).
      </p>
      <RandomizerNameInput value={name} onChange={setName} />
      <SelectionModeRadio
        value={selectionMode}
        onValueChange={setSelectionMode}
      />
      {selectionMode === "one-by-one" && (
        <AutoRemoveCheckbox
          entityType="subgroups"
          checked={autoRemove}
          onCheckedChange={setAutoRemove}
        />
      )}
      <GroupsSelect
        classId={classId}
        selectedGroups={selectedGroups}
        onGroupsSelect={setSelectedGroups}
        showSubgroups={true}
        selectedSubgroups={selectedSubgroups}
        onSubgroupsSelect={setSelectedSubgroups}
      />

      {/* Add your randomize button here */}
      <Button size={"lg"} onClick={handleRandomizeSubgroup}>
        <Shuffle /> Shuffle Subgroups
      </Button>
    </div>
  );
};

export default SubgroupTab;
