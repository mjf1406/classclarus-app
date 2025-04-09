// import Loader from "@/components/Loader";
import { Loader2 } from "lucide-react";

export default function Loading() {
  // return <Loader />;
  return (
    <div className="flex w-full items-center justify-center">
      <Loader2 className="h-24 w-24 animate-spin" />
    </div>
  );
}
