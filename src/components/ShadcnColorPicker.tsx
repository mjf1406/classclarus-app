"use client";

import { forwardRef, useMemo, useState } from "react";
import { HexColorPicker } from "react-colorful";
import { cn } from "@/lib/utils";
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

type ShadcnColorPickerProps = Omit<
  React.ComponentPropsWithoutRef<typeof Button>,
  "value" | "onChange" | "onBlur"
> &
  ColorPickerProps;

const ShadcnColorPicker = forwardRef<HTMLInputElement, ShadcnColorPickerProps>(
  (
    { disabled, value, onChange, onBlur, name, className, ...props },
    forwardedRef,
  ) => {
    // Ensure that the forwarded ref is typed as an HTMLInputElement.
    const ref = useForwardedRef<HTMLInputElement>(forwardedRef);
    const [open, setOpen] = useState(false);

    // Annotate parsedValue explicitly as a string.
    const parsedValue: string = useMemo(
      (): string => value ?? "#FFFFFF",
      [value],
    );

    return (
      <Popover onOpenChange={setOpen} open={open}>
        <PopoverTrigger asChild disabled={disabled} onBlur={onBlur}>
          <Button
            {...props}
            className={cn("block", className)}
            name={name}
            onClick={() => {
              setOpen(true);
            }}
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
          align="end"
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
