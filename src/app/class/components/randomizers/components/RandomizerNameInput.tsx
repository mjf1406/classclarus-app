"use client";

import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Dices } from "lucide-react";
import { generateSlug } from "random-word-slugs";

interface RandomizerNameInputProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
}

function generateName(): string {
  const now = new Date();

  // Format date as YYYY-MM-DD using locale
  const date = now.toLocaleDateString("sv-SE"); // Swedish locale gives YYYY-MM-DD format

  // Format time as HH:MM in user's timezone
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const time = `${hours}:${minutes}`;

  return `${generateSlug()} ${date} @ ${time}`;
}

const RandomizerNameInput: React.FC<RandomizerNameInputProps> = ({
  value = "",
  onChange,
  placeholder = "Name this randomization",
}) => {
  const handleGenerateRandomName = () => {
    const randomName = generateName();
    onChange?.(randomName);
  };

  return (
    <div className="max-w-lg space-y-2">
      <Label>Name</Label>
      <div className="flex items-center justify-center gap-2">
        <Input
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          className="flex-1"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={handleGenerateRandomName}
          className="px-3"
        >
          <Dices className="h-6 w-6" />
        </Button>
      </div>
      <p className="text-muted-foreground ml-2 text-sm">
        Leaving the name blank means it will not be saved. Saving allows you to
        resume it at a later date and/or reference it later, along with checking
        off students.
      </p>
    </div>
  );
};

export default RandomizerNameInput;
