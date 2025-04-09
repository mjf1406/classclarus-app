// MyClassesPage.tsx (server component)
import ClassList from "@/components/ClassList";
import { Navbar } from "@/components/NavBar";

export default async function MyClassesPage() {
  return (
    <>
      <Navbar />
      <div className="mt-5 flex flex-col items-center justify-center gap-10">
        <h1 className="text-3xl font-semibold">My Classes</h1>
        <ClassList />
      </div>
    </>
  );
}
