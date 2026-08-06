import { lazy, Suspense } from "react";
import type { FontAwesomeIconPickerProps } from "./FontAwesomeIconPicker";

const FontAwesomeIconPicker = lazy(() =>
  import("./FontAwesomeIconPicker").then((m) => ({
    default: m.FontAwesomeIconPicker,
  })),
);

function PickerFallback() {
  return <div className="h-9 w-32 animate-pulse rounded-md bg-muted" />;
}

export function FontAwesomeIconPickerLazy(props: FontAwesomeIconPickerProps) {
  return (
    <Suspense fallback={<PickerFallback />}>
      <FontAwesomeIconPicker {...props} />
    </Suspense>
  );
}
