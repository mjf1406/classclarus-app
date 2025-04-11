"use client";

import React from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ClassByIdOptions } from "../api/queryOptions";
import { CircleX, Loader2 } from "lucide-react";
// Import shadcn Tabs components
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useQueryState } from "nuqs";
import "src/lib/string.extensions.ts";

function useIsMdUp() {
  const [isMdUp, setIsMdUp] = React.useState(
    typeof window !== "undefined" ? window.innerWidth >= 768 : true,
  );

  React.useEffect(() => {
    const handleResize = () => {
      setIsMdUp(window.innerWidth >= 768);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return isMdUp;
}

export default function ClassPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const classId = searchParams.get("class_id");
  const tabParam = searchParams.get("tab") ?? "points";
  const [tab, setTab] = useQueryState("tab");
  const isMdUp = useIsMdUp();

  const widthCalc = isMdUp
    ? "calc(100dvw - var(--sidebar-width) - 20px)"
    : "calc(100dvw - 15px)";

  const { data, error, isLoading } = useQuery(ClassByIdOptions(classId));

  React.useEffect(() => {
    if (data) {
      const newTitle = `${
        data?.classInfo.class_name
      } | ${tab?.toTitleCase() ?? tabParam.toTitleCase()}`;
      document.title = newTitle;
    }
  }, [data, tab, tabParam]);

  if (!classId) {
    return (
      <div
        className="bg-destructive min-h-screen w-screen px-5 py-3"
        style={{ width: widthCalc }}
      >
        <h1 className="mb-2 flex flex-row items-center gap-2 text-3xl font-bold">
          <CircleX size={36} /> No Class ID Provided
        </h1>
        <p className="max-w-lg">Please select a class in the sidebar.</p>
        <br />
        <p className="max-w-lg">
          There was no <span className="italic">class_id</span> in the URL. If
          someone sent you this URL, let them know that they need to share the
          entire URL and that they must not exclude the parts after the question
          mark (?).
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <Loader2 className="h-24 w-24 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-5 py-3 text-red-500">
        {error instanceof Error ? error.message : "An error occurred"}
      </div>
    );
  }

  return (
    <div className="px-5 py-3">
      <h1 className="mb-2 text-3xl font-bold">
        {data?.classInfo.class_name} ({data?.classInfo.class_year})
      </h1>
      <Tabs value={tabParam} onValueChange={setTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="assigners">Assigners</TabsTrigger>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="expectations">Expectations</TabsTrigger>
          <TabsTrigger value="points">Points</TabsTrigger>
          <TabsTrigger value="random-event">Random Event</TabsTrigger>
          <TabsTrigger value="randomizer">Randomizer</TabsTrigger>
          <TabsTrigger value="silent-chat">Silent Chat</TabsTrigger>
          <TabsTrigger value="shuffler">Shuffler</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
        </TabsList>
        <TabsContent value="assigners">
          <p>This is the assigners content.</p>
        </TabsContent>
        <TabsContent value="dashboard">
          <p>This is the dashboard content.</p>
        </TabsContent>
        <TabsContent value="expectations">
          <p>This is the expectations content.</p>
        </TabsContent>
        <TabsContent value="points">
          <p>This is the points content.</p>
        </TabsContent>
        <TabsContent value="random-event">
          <p>
            Randomly choose a daily event from default options or ones
            you&apos;ve added.
          </p>
        </TabsContent>
        <TabsContent value="randomizer">
          <p>
            Randomly select a group, team, or student for activities or
            assignments.
          </p>
        </TabsContent>
        <TabsContent value="silent-chat">
          <p>
            Communicate silently with a student by passing your phone between
            each other.
          </p>
        </TabsContent>
        <TabsContent value="shuffler">
          <p>
            Randomly order your groups, teams, or students, ensuring everyone
            gets a chance to be first and last before any repeats.
          </p>
        </TabsContent>
        <TabsContent value="tasks">
          <p>This is the tasks content.</p>
        </TabsContent>
      </Tabs>
    </div>
  );
}
