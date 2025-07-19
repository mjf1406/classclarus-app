"use client";

import React from "react";
import { Checkbox } from "@/components/ui/checkbox";

interface AutoRemoveCheckboxProps {
  entityType: "groups" | "subgroups" | "students";
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

const AutoRemoveCheckbox: React.FC<AutoRemoveCheckboxProps> = ({
  entityType,
  checked,
  onCheckedChange,
}) => {
  return (
    <div className="flex items-center space-x-2">
      <Checkbox
        id="auto-remove"
        checked={checked}
        onCheckedChange={onCheckedChange}
      />
      <label
        htmlFor="auto-remove"
        className="text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
      >
        Auto-remove selected {entityType}
      </label>
    </div>
  );
};

export default AutoRemoveCheckbox;
