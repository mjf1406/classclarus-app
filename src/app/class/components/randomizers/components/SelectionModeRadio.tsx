"use client";

import React from "react";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface SelectionModeRadioProps {
  value?: string;
  onValueChange?: (value: string) => void;
  defaultValue?: string;
}

const SelectionModeRadio: React.FC<SelectionModeRadioProps> = ({
  value,
  onValueChange,
  defaultValue = "all-at-once",
}) => {
  return (
    <div className="space-y-2">
      <Label>Selection Mode</Label>
      <RadioGroup
        value={value}
        onValueChange={onValueChange}
        defaultValue={defaultValue}
        className="flex flex-row gap-2"
      >
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="one-by-one" id="one-by-one" disabled />
          <Label htmlFor="one-by-one" className="disabled">
            One by one
          </Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="all-at-once" id="all-at-once" />
          <Label htmlFor="all-at-once">All at once</Label>
        </div>
      </RadioGroup>
    </div>
  );
};

export default SelectionModeRadio;
