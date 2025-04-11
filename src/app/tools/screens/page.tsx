import { Suspense } from "react";
import ItemGrid from "@/components/ItemGrid";
import { screensData } from "@/lib/constants";
import Loader from "@/components/Loader";

export default async function ScreensPage() {
  return (
    <Suspense fallback={<Loader />}>
      <ItemGrid data={screensData} />
    </Suspense>
  );
}
