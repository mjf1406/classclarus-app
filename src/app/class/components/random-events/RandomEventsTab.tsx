// src\app\class\components\random-events\RandomEventsTab.tsx
"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { RandomEventsOptions } from "@/app/api/queryOptions";
import LoaderSmallInline from "@/components/loaders/LoaderSmall";
import { CreateRandomEventDialog } from "./CreateRandomEventDialog";
import { Button } from "@/components/ui/button";
import { Dices, Plus, SquarePlus } from "lucide-react";
import RandomEventsList from "./RandomEventList";
import type { RandomEvent } from "@/server/db/schema";
import { AddDefaultEventsDialog } from "./AddDefaultRandomEventsDialog";
import { RandomEventPickerModal } from "./RandomEventPickerModal";

interface RandomEventsTabProps {
  classId: string | null;
}

const RandomEventsTab: React.FC<RandomEventsTabProps> = ({ classId }) => {
  const { data, isLoading, error } = useQuery<RandomEvent[]>(
    RandomEventsOptions(classId),
  );

  if (isLoading) return <LoaderSmallInline />;
  if (error) {
    return <div className="text-red-600">Error: {error.message}</div>;
  }
  if (!data) {
    return <div className="text-red-600">Error:</div>;
  }

  return (
    <div className="mb-5 space-y-2">
      <div className="flex w-full justify-between">
        <h2 className="block text-2xl font-semibold lg:hidden">
          Random Events
        </h2>
        <div className="space-x-2">
          <RandomEventPickerModal
            classId={classId ?? ""}
            trigger={
              <Button variant="default">
                <Dices />
                <span className="hidden md:block">Pick Random Event</span>
              </Button>
            }
          />
          <CreateRandomEventDialog
            classId={classId ?? ""}
            trigger={
              <Button variant="secondary">
                <Plus />
                <span className="hidden md:block">Create Random Event</span>
              </Button>
            }
          />
          <AddDefaultEventsDialog
            classId={classId ?? ""}
            trigger={
              <Button variant="outline">
                <SquarePlus />
                <span className="hidden md:block">Add Defaults</span>
              </Button>
            }
          />
        </div>
      </div>
      <RandomEventsList events={data} classId={classId ?? ""} />
    </div>
  );
};

export default RandomEventsTab;
