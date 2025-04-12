import ItemGrid from "@/components/ItemGrid";
import { generatorsData } from "@/lib/constants";

export default async function GeneratorsPage() {
  return <ItemGrid data={generatorsData} />;
}
