import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

/** 3 cols always; 6.5rem cap keeps compact squares on wide viewports. */
export const TASK_STUDENT_GRID_CLASS =
  "grid w-fit max-w-full gap-1.5 [grid-template-columns:repeat(3,minmax(0,6.5rem))] sm:gap-2";

type TaskStudentCompletionCardProps = {
  firstName: string;
  lastName?: string;
  completed: boolean;
  disabled: boolean;
  ariaLabel: string;
  onToggle: () => void;
};

export function TaskStudentCompletionCard({
  firstName,
  lastName,
  completed,
  disabled,
  ariaLabel,
  onToggle,
}: TaskStudentCompletionCardProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={completed}
      aria-label={ariaLabel}
      onClick={onToggle}
      className={cn(
        "relative flex aspect-square w-full flex-col items-center justify-center overflow-hidden rounded-xl border px-1.5 py-2 text-center transition-colors",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        completed
          ? "border-primary bg-primary text-primary-foreground"
          : "bg-card hover:bg-accent/40",
        disabled && "cursor-not-allowed opacity-60",
      )}
    >
      {completed ? (
        <Check className="absolute top-1 left-1 size-3" strokeWidth={3} aria-hidden />
      ) : null}
      <span className="line-clamp-2 text-xs leading-tight font-semibold tracking-tight break-words sm:text-sm">
        {firstName}
      </span>
      {lastName ? (
        <span
          className={cn(
            "mt-0.5 line-clamp-1 text-xs leading-tight",
            completed ? "text-primary-foreground/80" : "text-muted-foreground",
          )}
        >
          {lastName}
        </span>
      ) : null}
    </button>
  );
}
