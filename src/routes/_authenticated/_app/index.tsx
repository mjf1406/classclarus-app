import { createFileRoute } from "@tanstack/react-router";

import { ClassesHomePage } from "@/components/classes/ClassesHomePage";

export const Route = createFileRoute("/_authenticated/_app/")({
  component: ClassesHomePage,
});
