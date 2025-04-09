interface Params {
  classId: string;
  className: string;
}

export default async function ClassPage({
  params,
}: {
  params: Promise<Params>;
}) {
  // Now await the params because it's a promise
  const { classId } = await params;

  return (
    <div className="px-5 py-3">
      <h1 className="text-3xl font-semibold">Class {classId}</h1>
    </div>
  );
}
