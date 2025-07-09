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
  /**
   * The base step when clicking ± once.
   * You can override this to something like 0.1 or 0.01, etc.
   */
  step?: number;
  onChange: (newVal: number) => void;
  /** Optional extra class names */
  className?: string;
  /** Control the tabIndex of the <input> */
  tabIndex?: number;
  /** Get a ref to the underlying <input> */
  inputRef?: React.Ref<HTMLInputElement>;
}

export function NumberInputWithStepper({
  value,
  min,
  max,
  step = 1,
  onChange,
  className,
  tabIndex,
  inputRef,
}: NumberInputWithStepperProps) {
  // Count how many decimals are in step, so we can round correctly
  const getDecimalPlaces = (n: number) => {
    const m = /\.([0-9]+)$/.exec(n.toString());
    return m ? m[1]?.length : 0;
  };
  const precision = getDecimalPlaces(step);

  const clamp = (v: number) => Math.min(Math.max(v, min), max);

  const handleStep = (
    delta: number,
    e: React.MouseEvent<HTMLButtonElement>,
  ) => {
    // shift → ×10, ctrl → ×5, else ×1
    const multiplier = e.shiftKey ? 10 : e.ctrlKey ? 5 : 1;
    const raw = value + delta * step * multiplier;
    // round to avoid floating‐point quirks
    const rounded = parseFloat(raw.toFixed(precision));
    onChange(clamp(rounded));
  };

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    let v = parseFloat(e.target.value);
    if (isNaN(v)) v = min;
    onChange(clamp(v));
  };

  return (
    <div
      className={`inline-flex items-center ${styles.noSpin} ${className ?? ""}`}
    >
      <Button
        variant="outline"
        size="icon"
        onClick={(e) => handleStep(-1, e)}
        tabIndex={-1}
        aria-label="decrement"
        className="rounded-l-md rounded-r-none border-r-0"
      >
        <Minus className="h-4 w-4" />
      </Button>

      <Input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={handleInput}
        ref={inputRef}
        tabIndex={tabIndex}
        className="w-16 rounded-none border-r-0 border-l-0 p-1 text-center"
      />

      <Button
        variant="outline"
        size="icon"
        onClick={(e) => handleStep(1, e)}
        tabIndex={-1}
        aria-label="increment"
        className="rounded-l-none rounded-r-md border-l-0"
      >
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  );
}
