// MyClassesPage.tsx (server component)
import ClassList from "@/components/ClassList";
import { Navbar } from "@/components/NavBar";
import { Button } from "@/components/ui/button";
import { Handshake, Plus, PlusSquare } from "lucide-react";

export default async function MyClassesPage() {
  return (
    <>
      <Navbar />
      <div className="flex w-full items-center justify-center">
        <div className="mt-5 flex w-full max-w-4xl flex-col items-center justify-center gap-10 px-6 sm:px-6 md:px-4 lg:min-w-3xl lg:px-0">
          <div className="flex w-full flex-row items-center justify-between gap-2 self-start">
            <h1 className="text-3xl font-semibold">My Classes</h1>
            <div className="flex flex-row gap-2">
              <Button className="text-foreground">
                <Plus /> <span className="hidden sm:block">Add class</span>
              </Button>
              <Button variant={"secondary"} className="text-foreground">
                <Handshake />{" "}
                <span className="hidden sm:block">Join class</span>
              </Button>
              <Button
                variant={"outline"}
                className="text-foreground dark:bg-card"
              >
                <PlusSquare />{" "}
                <span className="hidden sm:block">Add demo class</span>
              </Button>
            </div>
          </div>
          <ClassList />
        </div>
      </div>
    </>
  );
}
