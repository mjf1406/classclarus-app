import {
  ArrowLeftRightIcon,
  CheckIcon,
  MapPinIcon,
  TriangleAlertIcon,
  UsersIcon,
  XIcon,
} from "lucide-react";
import type { ReactNode } from "react";

import type { SeatConstraintPolarity, SeatConstraintType } from "@/lib/assigners/seatConstraints";

function polarityIcon(polarity: SeatConstraintPolarity): ReactNode {
  if (polarity === "must") {
    return (
      <CheckIcon
        className="size-3.5 shrink-0 text-emerald-600! dark:text-emerald-400!"
        aria-hidden
      />
    );
  }
  return <XIcon className="size-3.5 shrink-0 text-destructive!" aria-hidden />;
}

function typeIcon(type: SeatConstraintType): ReactNode {
  if (type === "neighbor") {
    return <ArrowLeftRightIcon className="size-3.5 shrink-0 text-muted-foreground!" aria-hidden />;
  }
  if (type === "teammate") {
    return <UsersIcon className="size-3.5 shrink-0 text-muted-foreground!" aria-hidden />;
  }
  return <MapPinIcon className="size-3.5 shrink-0 text-muted-foreground!" aria-hidden />;
}

export function ConstraintKindIcons({
  polarity,
  type,
}: {
  polarity: SeatConstraintPolarity;
  type: SeatConstraintType;
}) {
  return (
    <span className="inline-flex items-center gap-1" aria-hidden>
      {polarityIcon(polarity)}
      {typeIcon(type)}
    </span>
  );
}

export function ConstraintKindBadge({
  polarity,
  type,
  label,
}: {
  polarity: SeatConstraintPolarity;
  type: SeatConstraintType;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm whitespace-nowrap">
      <ConstraintKindIcons polarity={polarity} type={type} />
      <span>{label}</span>
    </span>
  );
}

function constraintTypeIcon(type: SeatConstraintType): ReactNode {
  if (type === "neighbor") {
    return <ArrowLeftRightIcon className="size-3.5 shrink-0 text-muted-foreground!" aria-hidden />;
  }
  if (type === "teammate") {
    return <UsersIcon className="size-3.5 shrink-0 text-muted-foreground!" aria-hidden />;
  }
  return <MapPinIcon className="size-3.5 shrink-0 text-muted-foreground!" aria-hidden />;
}

/** Warning context: no Must/Must-not polarity icons — only alert + constraint type. */
export function ViolationConstraintKindBadge({
  type,
  label,
}: {
  type: SeatConstraintType;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm whitespace-nowrap">
      <TriangleAlertIcon className="size-3.5 shrink-0 text-destructive!" aria-hidden />
      {constraintTypeIcon(type)}
      <span>{label}</span>
    </span>
  );
}
