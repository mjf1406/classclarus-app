"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { ClassByIdOptions, RandomizersOptions } from "@/app/api/queryOptions";
import LoaderSmallInline from "@/components/loaders/LoaderSmall";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import GroupsSelect from "@/components/selects/GroupSelect";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  FormControl,
  FormDescription,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

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

  function onGroupsSelectTeam() {
    return [];
  }
  function onGroupsSelectStudent() {
    return [];
  }

  return (
    <Tabs defaultValue={"group"}>
      <TabsList className="mb-4">
        <TabsTrigger value="group">Group</TabsTrigger>
        <TabsTrigger value="team">Team</TabsTrigger>
        <TabsTrigger value="student">Student</TabsTrigger>
      </TabsList>
      <TabsContent value="group" className="space-y-2">
        <Input
          type="text"
          placeholder="Name this randomization"
          className="max-w-lg"
        />
        <RadioGroup defaultValue="one-by-one" className="flex flex-row gap-2">
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="one-by-one" id="one-by-one" />
            <Label htmlFor="one-by-one">One by one</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="all-at-once" id="all-at-once" />
            <Label htmlFor="all-at-once">All at once</Label>
          </div>
        </RadioGroup>
        <div className="flex items-center space-x-2">
          <Checkbox id="auto-remove" />
          <label
            htmlFor="auto-remove"
            className="text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            Auto-remove selected groups
          </label>
        </div>
        {/* Only needs to randomly pick a group from classData.group */}
      </TabsContent>
      <TabsContent value="team" className="space-y-6">
        <div className="max-w-lg space-y-2">
          <Label>Name</Label>
          <Input type="text" placeholder="Name this randomization" />
          <p className="text-muted-foreground ml-2 text-sm">
            Leaving the name blank means it will not be saved. Saving allows you
            to resume it at a later date and/or reference it later, along with
            checking off students who have done something.
          </p>
        </div>
        {/* <FormItem>
          <FormLabel>Name</FormLabel>
          <FormControl>
          <Input placeholder="shadcn" {...field} />
          </FormControl>
          <FormDescription>
          Leaving the name blank means it will not be saved. Saving allows you
          to resume it at a later date and/or reference it later, along with
            checking off students who have done something.
          </FormDescription>
          <FormMessage />
          </FormItem> */}
        <div className="space-y-2">
          <Label>Selection Mode</Label>
          <RadioGroup defaultValue="one-by-one" className="flex flex-row gap-2">
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="one-by-one" id="one-by-one" />
              <Label htmlFor="one-by-one">One by one</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="all-at-once" id="all-at-once" />
              <Label htmlFor="all-at-once">All at once</Label>
            </div>
          </RadioGroup>
        </div>
        <div className="flex items-center space-x-2">
          <Checkbox id="auto-remove" />
          <label
            htmlFor="auto-remove"
            className="text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            Auto-remove selected teams
          </label>
        </div>
        <GroupsSelect classId={classId} onGroupsSelect={onGroupsSelectTeam} />
        {/* Randomly selects a team from the selected groups in GroupsSelect */}
      </TabsContent>
      <TabsContent value="student" className="space-y-2">
        <Input
          type="text"
          placeholder="Name this randomization"
          className="max-w-lg"
        />
        <RadioGroup defaultValue="one-by-one" className="flex flex-row gap-2">
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="one-by-one" id="one-by-one" />
            <Label htmlFor="one-by-one">One by one</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="all-at-once" id="all-at-once" />
            <Label htmlFor="all-at-once">All at once</Label>
          </div>
        </RadioGroup>
        <div className="flex items-center space-x-2">
          <Checkbox id="auto-remove" />
          <label
            htmlFor="auto-remove"
            className="text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            Auto-remove selected students
          </label>
        </div>
        <GroupsSelect
          classId={classId}
          onGroupsSelect={onGroupsSelectStudent}
        />
        {/* TODO: <TeamSelect /> */}
        {/* The selected group(s) determine the selectable teams, then a student is randomly selected from selected groups and selected teams */}
      </TabsContent>
    </Tabs>
  );
};

export default RandomizersTab;
