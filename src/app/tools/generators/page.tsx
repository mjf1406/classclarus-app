import { Suspense } from "react";
import ItemGrid from "@/components/ItemGrid";
import { generatorsData } from "@/lib/constants";
import Loader from "@/components/Loader";

export default async function GeneratorsPage() {
  return (
    <Suspense fallback={<Loader />}>
      <ItemGrid data={generatorsData} />
    </Suspense>
  );
}
