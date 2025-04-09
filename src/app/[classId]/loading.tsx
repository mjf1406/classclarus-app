import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div className="m-auto flex h-dvh w-dvw items-center justify-center">
      <Loader2 className="h-24 w-24 animate-spin" />
    </div>
  );
}
