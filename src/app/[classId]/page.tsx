type Params = {
  classId: string;
  className: string;
};

export default async function ClassPage({ params }: { params: Params }) {
  const { classId, className } = params; // need to await in next 16

  return (
    <div className="px-5 py-3">
      <h1 className="text-3xl font-semibold">Class {classId}</h1>
    </div>
  );
}
