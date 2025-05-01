"use client";

import { forwardRef, useMemo, useState } from "react";
import { HexColorPicker } from "react-colorful";
import { cn } from "@/lib/utils";
import type { ButtonProps } from "@/components/ui/button";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { useForwardedRef } from "@/lib/use-forwarded-ref";

interface ColorPickerProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
}

const ShadcnColorPicker = forwardRef<
  HTMLInputElement,
  Omit<ButtonProps, "value" | "onChange" | "onBlur"> & ColorPickerProps
>(
  (
    { disabled, value, onChange, onBlur, name, className, ...props },
    forwardedRef,
  ) => {
    const ref = useForwardedRef(forwardedRef);
    const [open, setOpen] = useState(false);

    const parsedValue = useMemo(() => {
      return value || "#FFFFFF";
    }, [value]);

    return (
      <Popover onOpenChange={setOpen} open={open}>
        <PopoverTrigger asChild disabled={disabled} onBlur={onBlur}>
          <Button
            {...props}
            className={cn("block", className)}
            name={name}
            onClick={() => setOpen(true)}
            size="icon"
            style={{
              backgroundColor: parsedValue,
            }}
            variant="outline"
          >
            <div />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align={"end"}
          className="border-muted w-full dark:border-2"
        >
          <HexColorPicker color={parsedValue} onChange={onChange} />
          <Input
            maxLength={7}
            onChange={(e) => onChange(e.currentTarget.value)}
            ref={ref}
            value={parsedValue}
          />
          <p className="text-muted-foreground mt-2 max-w-[12rem] text-xs">
            Looking for a specific color? Try Googling, for example,{" "}
            <span className="font-medium">&quot;red hex code&quot;</span>, then
            pasting that code into the box above!
          </p>
        </PopoverContent>
      </Popover>
    );
  },
);

ShadcnColorPicker.displayName = "ShadcnColorPicker";

export { ShadcnColorPicker };
