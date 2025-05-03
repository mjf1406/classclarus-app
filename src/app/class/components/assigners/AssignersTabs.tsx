"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { AssignersOptions } from "@/app/api/queryOptions";
import LoaderSmallInline from "@/components/loaders/LoaderSmall";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import RandomAssignerForm from "./RandomAssigner";

interface AssignersTabProps {
  classId: string | null;
}

const AssignersTab: React.FC<AssignersTabProps> = ({ classId }) => {
  const { data, isLoading, error } = useQuery(AssignersOptions(classId));
  console.log("🚀 ~ data:", data);

  if (isLoading) return <LoaderSmallInline />;
  if (error) {
    const err = error;
    return <div>Error: {err.message}</div>;
  }

  return (
    <div>
      <Tabs defaultValue={"random"}>
        <TabsList>
          <TabsTrigger value="random">Random</TabsTrigger>
          <TabsTrigger value="round-robin">Round Robin</TabsTrigger>
          <TabsTrigger value="seats">Seats</TabsTrigger>
        </TabsList>
        <TabsContent value="random">
          {/* Random Assigner Form */}
          <RandomAssignerForm classId={classId ?? ""} />
        </TabsContent>
        <TabsContent value="round-robin">
          <Tabs defaultValue={"assigner"}>
            <TabsList className="-mt-2">
              <TabsTrigger value="assigner">Assigner</TabsTrigger>
              <TabsTrigger value="table">History</TabsTrigger>
            </TabsList>
            <TabsContent value="assigner">
              <p>This is the round-robin assigner form.</p>
            </TabsContent>
            <TabsContent value="table">
              <p>This is the round-robin assigner history.</p>
            </TabsContent>
          </Tabs>
        </TabsContent>
        <TabsContent value="seats">
          <Tabs defaultValue={"assigner"}>
            <TabsList className="-mt-2">
              <TabsTrigger value="assigner">Assigner</TabsTrigger>
              <TabsTrigger value="table">History</TabsTrigger>
            </TabsList>
            <TabsContent value="assigner">
              <p>This is the seats assigner form.</p>
            </TabsContent>
            <TabsContent value="table">
              <p>This is the seats assigner history.</p>
            </TabsContent>
          </Tabs>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AssignersTab;
