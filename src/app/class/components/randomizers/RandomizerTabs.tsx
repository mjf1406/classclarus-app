"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ClassByIdOptions,
  RandomizationsOptions,
} from "@/app/api/queryOptions";
import LoaderSmallInline from "@/components/loaders/LoaderSmall";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import GroupTab from "./tabs/GroupTab";
import SubgroupTab from "./tabs/SubgroupTab";
import StudentTab from "./tabs/StudentTab";
import { RandomizationManagerDialog } from "./components/RandomizationManagerDialog";
import { Button } from "@/components/ui/button";
import { MemoryStick } from "lucide-react";

interface RandomizersTabProps {
  classId: string | null;
}

const RandomizersTab: React.FC<RandomizersTabProps> = ({ classId }) => {
  const {
    data: randomizationsData,
    isLoading: randomizationsLoading,
    error: randomizationsError,
  } = useQuery(RandomizationsOptions(classId));
  const {
    data: classData,
    isLoading: classDataLoading,
    error: classDataError,
  } = useQuery(ClassByIdOptions(classId));

  if (randomizationsLoading || classDataLoading) return <LoaderSmallInline />;

  if (randomizationsError || classDataError) {
    const err = randomizationsError ?? classDataError;
    return <div>Error: {err?.message}</div>;
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="block text-xl font-semibold lg:hidden">Randomizer</h2>
        <RandomizationManagerDialog
          classId={classId ?? ""}
          trigger={
            <Button variant="outline">
              <MemoryStick />{" "}
              <span className="hidden md:block">Randomizations</span>
            </Button>
          }
        />
      </div>
      <div>
        <p>
          We track how often each student is placed in the first or last
          position. Students with lower counts are prioritized for those
          positions to ensure fairness.
        </p>
      </div>
      <Tabs defaultValue={"student"} className="pb-10">
        <TabsList className="mb-4">
          {/* <TabsTrigger value="group">Group</TabsTrigger>
        <TabsTrigger value="subgroup">Subgroup</TabsTrigger> */}
          <TabsTrigger value="student">Student</TabsTrigger>
        </TabsList>
        <TabsContent value="group">
          <GroupTab classId={classId} />
        </TabsContent>
        <TabsContent value="subgroup">
          <SubgroupTab classId={classId} />
        </TabsContent>
        <TabsContent value="student">
          <StudentTab
            classId={classId}
            _groups={classData?.groups}
            _subgroups={classData?.subGroups}
            studentGroups={classData?.studentGroups}
            studentSubGroups={classData?.studentSubGroups}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default RandomizersTab;
