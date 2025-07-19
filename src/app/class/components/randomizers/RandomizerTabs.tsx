"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { ClassByIdOptions, RandomizersOptions } from "@/app/api/queryOptions";
import LoaderSmallInline from "@/components/loaders/LoaderSmall";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import GroupTab from "./tabs/GroupTab";
import SubgroupTab from "./tabs/SubgroupTab";
import StudentTab from "./tabs/StudentTab";

interface RandomizersTabProps {
  classId: string | null;
}

const RandomizersTab: React.FC<RandomizersTabProps> = ({ classId }) => {
  const {
    data: assignerData,
    isLoading: assignerIsLoading,
    error: assignerError,
  } = useQuery(RandomizersOptions(classId));
  const {
    data: classData,
    isLoading: classDataLoading,
    error: classDataError,
  } = useQuery(ClassByIdOptions(classId));

  if (assignerIsLoading || classDataLoading) return <LoaderSmallInline />;

  if (assignerError || classDataError) {
    const err = assignerError ?? classDataError;
    return <div>Error: {err?.message}</div>;
  }

  return (
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
  );
};

export default RandomizersTab;
