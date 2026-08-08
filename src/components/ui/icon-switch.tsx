import type { ReactNode } from "react";
import { Switch as SwitchPrimitive } from "@base-ui/react/switch";

import { cn } from "@/lib/utils";

type IconSwitchProps = Omit<SwitchPrimitive.Root.Props, "children"> & {
  checkedIcon: ReactNode;
  uncheckedIcon: ReactNode;
};

function IconSwitch({ className, checkedIcon, uncheckedIcon, ...props }: IconSwitchProps) {
  return (
    <SwitchPrimitive.Root
      data-slot="icon-switch"
      className={cn(
        "peer group/icon-switch relative inline-flex h-9 w-16 shrink-0 items-center rounded-full border border-transparent p-0.5 transition-all outline-none after:absolute after:-inset-x-2 after:-inset-y-1.5 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-[3px] aria-invalid:ring-destructive/20 data-checked:bg-primary data-unchecked:bg-input dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 dark:data-unchecked:bg-input/80 data-disabled:cursor-not-allowed data-disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="icon-switch-thumb"
        className="pointer-events-none flex size-8 items-center justify-center rounded-full bg-background text-foreground/70 ring-0 transition-transform data-checked:translate-x-[calc(100%-2px)] data-unchecked:translate-x-0 [&_svg]:size-4 dark:data-checked:bg-primary-foreground dark:data-checked:text-primary dark:data-unchecked:bg-foreground dark:data-unchecked:text-background"
      >
        <span className="flex items-center justify-center group-data-checked/icon-switch:hidden">
          {uncheckedIcon}
        </span>
        <span className="hidden items-center justify-center group-data-checked/icon-switch:flex">
          {checkedIcon}
        </span>
      </SwitchPrimitive.Thumb>
    </SwitchPrimitive.Root>
  );
}

export { IconSwitch };
