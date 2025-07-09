// NumberInputWithStepper.tsx
"use client";

import * as React from "react";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import styles from "./css/NumberInputWithStepper.module.css";

export interface NumberInputWithStepperProps {
  value: number;
  min: number;
  max: number;
  onChange: (newVal: number) => void;
  className?: string;
}

export function NumberInputWithStepper({
  value,
  min,
  max,
  onChange,
  className,
}: NumberInputWithStepperProps) {
  const handleStep = (
    delta: number,
    e: React.MouseEvent<HTMLButtonElement>,
  ) => {
    const step = e.shiftKey ? 10 : e.ctrlKey ? 5 : 1;
    let next = value + delta * step;
    if (next < min) next = min;
    if (next > max) next = max;
    onChange(next);
  };

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = parseInt(e.target.value, 10);
    if (isNaN(val)) val = min;
    if (val < min) val = min;
    if (val > max) val = max;
    onChange(val);
  };

  return (
    <div
      className={`inline-flex items-center ${styles.noSpin} ${className ?? ""}`}
    >
      <Button
        variant="outline"
        size="icon"
        onClick={(e) => handleStep(-1, e)}
        className="rounded-l-md rounded-r-none border-r-0"
      >
        <Minus className="h-4 w-4" />
      </Button>

      <Input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={handleInput}
        className="w-12 rounded-none border-r-0 border-l-0 p-1 text-center"
      />

      <Button
        variant="outline"
        size="icon"
        onClick={(e) => handleStep(1, e)}
        className="rounded-l-none rounded-r-md border-l-0"
      >
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  );
}
