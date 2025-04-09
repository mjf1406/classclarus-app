// MyClassesPage.tsx (server component)
import ClassList from "@/components/ClassList";
import { Navbar } from "@/components/NavBar";
import { Button } from "@/components/ui/button";

export default async function MyClassesPage() {
  return (
    <>
      <Navbar />
      <div className="flex w-full items-center justify-center">
        <div className="mt-5 flex max-w-4xl min-w-3xl flex-col items-center justify-center gap-10">
          <div className="flex w-full flex-row items-center justify-between gap-2 self-start">
            <h1 className="text-3xl font-semibold">My Classes</h1>
            <div className="flex flex-row gap-2">
              <Button className="text-foreground">Add class</Button>
              <Button className="text-foreground">Join class</Button>
              <Button className="text-foreground">Add demo class</Button>
            </div>
          </div>
          <ClassList />
        </div>
      </div>
    </>
  );
}
