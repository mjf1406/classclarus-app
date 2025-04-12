"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { PointsByClassIdOptions } from "@/app/api/queryOptions";
import LoaderSmallInline from "@/components/loaders/LoaderSmall";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface PointsTabProps {
  classId: string | null;
}

const PointsTab: React.FC<PointsTabProps> = ({ classId }) => {
  // Using our query options for fetching points data.
  const { data, isLoading, error } = useQuery(PointsByClassIdOptions(classId));

  if (isLoading) return <LoaderSmallInline />;
  if (error) {
    // Cast error to Error type to access the message property.
    const err = error;
    return <div>Error: {err.message}</div>;
  }

  return (
    <div>
      <Tabs defaultValue={"class"}>
        <TabsList className="mb-4">
          <TabsTrigger value="class">Class</TabsTrigger>
          <TabsTrigger value="groups">Groups</TabsTrigger>
          <TabsTrigger value="teams">Teams</TabsTrigger>
          <TabsTrigger value="students">Students</TabsTrigger>
        </TabsList>
        <TabsContent value="class">
          <p>This is the class dashboard.</p>
        </TabsContent>
        <TabsContent value="groups">
          <p>This is the groups dashboard.</p>
        </TabsContent>
        <TabsContent value="teams">
          <p>This is the teams dashboard.</p>
        </TabsContent>
        <TabsContent value="students">
          <p>This is the students dashboard.</p>
        </TabsContent>
      </Tabs>
      There are{" "}
      <span className="font-bold">{data?.length.toLocaleString()}</span> rows.
    </div>
  );
};

export default PointsTab;
