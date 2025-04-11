"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  TeacherClassesOptions,
  type TeacherClassDetail,
} from "@/app/api/queryOptions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, AlertTriangle, CircleX } from "lucide-react";
import { SignedOut, useAuth } from "@clerk/nextjs";
import { SignInButton } from "./SignInButton";
import ClassCard from "./ClassCard";

const ClassList: React.FC = () => {
  const { data, isLoading, isError, error } = useQuery<TeacherClassDetail[]>(
    TeacherClassesOptions,
  );
  const { isSignedIn } = useAuth();

  if (!isSignedIn) {
    return (
      <div className="m-auto flex w-full items-center justify-center">
        <SignedOut>
          <SignInButton />
        </SignedOut>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="m-auto flex w-full max-w-4xl items-center justify-center lg:min-w-3xl">
        <Loader2 className="h-24 w-24 animate-spin" />
      </div>
    );
  }

  if (isError || error) {
    return (
      <div className="m-auto flex h-auto w-full items-center justify-center">
        <div className="max-w-5xl px-4">
          <Alert
            variant="destructive"
            className="flex w-full items-center gap-4"
          >
            <CircleX
              className="shrink-0"
              style={{ width: "36px", height: "36px" }}
            />
            <div className="w-full">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error.message}</AlertDescription>
            </div>
          </Alert>
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="m-auto flex h-auto w-full items-center justify-center">
        <div className="max-w-5xl px-4">
          <Alert variant="warning" className="flex w-full items-center gap-4">
            <AlertTriangle
              className="shrink-0"
              style={{ width: "36px", height: "36px" }}
            />

            <div className="w-full">
              <AlertTitle>No Classes!</AlertTitle>
              <AlertDescription className="whitespace-nowrap">
                <p>
                  Please click the{" "}
                  <span className="border-destructive rounded-lg border px-2 py-0.5 font-bold">
                    <span className="text-xl">+</span> Add class
                  </span>{" "}
                  button at the top of the page to add a class.
                </p>
              </AlertDescription>
            </div>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
      {data.map((item) => (
        <ClassCard key={item.teacherAssignment.assignment_id} detail={item} />
      ))}
    </div>
  );
};

export default ClassList;
