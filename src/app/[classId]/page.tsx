import { ClassPageClient } from "./ClassPageClient";

interface Params {
  classId: string;
  className: string;
}

interface ClassPageProps {
  params: Promise<Params>;
}

export default async function ClassPage({ params }: ClassPageProps) {
  const { classId } = await params;

  return <ClassPageClient classId={classId} />;
}
