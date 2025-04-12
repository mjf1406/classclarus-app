import { Loader2 } from "lucide-react";

export default function LoaderSmallInline() {
  return (
    <div className="flex items-center justify-start gap-1">
      <Loader2 className="h-5 w-5 animate-spin" /> Loading...
    </div>
  );
}
