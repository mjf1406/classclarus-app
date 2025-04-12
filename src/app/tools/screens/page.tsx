import ItemGrid from "@/components/ItemGrid";
import { screensData } from "@/lib/constants";

export default async function ScreensPage() {
  return <ItemGrid data={screensData} />;
}
