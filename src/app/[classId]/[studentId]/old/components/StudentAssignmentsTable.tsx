// components/AssignmentTable.tsx

"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "~/components/ui/dialog";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "~/components/ui/card";
import {
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableBody,
  TableCell,
} from "~/components/ui/table";
import { Button } from "~/components/ui/button";
import { ChevronDown, RotateCw } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "~/components/ui/collapsible";

interface Assignment {
  sa_id: string;
  sa_complete: boolean;
  assignment_name: string;
  assignment_description: string | null;
  assignment_data: string | null;
  due_date: string | null;
  topic: string | null;
  working_date: string | null;
  created_date: string;
  sa_completed_ts: string | null;
}

interface AssignmentTableProps {
  assignments: Assignment[];
}

// InstructionStep Component for Reusability
interface InstructionStepProps {
  number: number;
  text: React.ReactNode;
}

const InstructionStep: React.FC<InstructionStepProps> = ({ number, text }) => {
  return (
    <li className="flex items-start rounded-md bg-pink-100 p-4 transition-colors hover:bg-pink-200 dark:bg-gray-800 dark:hover:bg-pink-600">
      <span className="mr-4 text-lg font-bold text-orange-500">{number}.</span>
      <span className="text-gray-700 dark:text-gray-300">{text}</span>
    </li>
  );
};

// Helper function to format dates
const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);

  // Check if the date is the confusing default date
  if (
    date.getFullYear() === 1970 &&
    date.getMonth() === 0 && // Months are zero-based (0 = January)
    date.getDate() === 1 &&
    date.getHours() === 9 &&
    date.getMinutes() === 0 &&
    date.getSeconds() === 0
  ) {
    return "—"; // Show a dash instead of the confusing date
  }

  // Format date to a more readable format, e.g., April 30, 2024
  const options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "long",
    day: "numeric",
  };

  return date.toLocaleDateString(undefined, options);
};

// Helper function to format date and time
const formatDateTime = (dateTimeStr: string): string => {
  const date = new Date(dateTimeStr);

  // Check if the date is the confusing default date
  if (
    date.getFullYear() === 1970 &&
    date.getMonth() === 0 &&
    date.getDate() === 1 &&
    date.getHours() === 9 &&
    date.getMinutes() === 0 &&
    date.getSeconds() === 0
  ) {
    return "—"; // Show a dash instead of the confusing date
  }

  // Format date and time to a more readable format, e.g., April 30, 2024, 5:00 PM
  const options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  };

  return date.toLocaleString(undefined, options);
};

const AssignmentTable: React.FC<AssignmentTableProps> = ({ assignments }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isInstructionsOpen, setIsInstructionsOpen] = useState(false);
  // New state to hold the clicked assignment
  const [selectedAssignment, setSelectedAssignment] =
    useState<Assignment | null>(null);

  // Get only the top 5 assignments
  const topAssignments = assignments.slice(0, 5);

  return (
    <>
      <Card className="mx-auto h-full w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Tasks</CardTitle>
          <CardDescription>
            Take a look at all the tasks you&apos;ve completed and all those
            left for you to do! Earn one point per completed task!
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            className="w-full"
            variant="secondary"
            onClick={() => setIsModalOpen(true)}
          >
            View all tasks
          </Button>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px] text-foreground">
                    Name
                  </TableHead>
                  <TableHead className="w-[100px] text-foreground">
                    Complete
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topAssignments.map((assignment) => (
                  <TableRow
                    key={assignment.sa_id}
                    // When a row is clicked, set the assignment as selected
                    onClick={() => setSelectedAssignment(assignment)}
                    className={`cursor-pointer ${
                      assignment.sa_complete
                        ? "bg-green-200 dark:bg-green-600"
                        : "bg-red-200 dark:bg-red-600"
                    } transition-colors hover:bg-blue-100 dark:hover:bg-blue-500`}
                  >
                    <TableCell>
                      <span className="font-bold text-gray-800 dark:text-gray-200">
                        {assignment.assignment_name}
                      </span>
                    </TableCell>
                    <TableCell className="text-gray-700 dark:text-gray-300">
                      {assignment.sa_complete ? "✅ Yes" : "❌ No"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Dialog for All Tasks */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-h-screen w-[100vw] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-4xl text-blue-700">
              📃 Tasks
            </DialogTitle>
            <DialogClose className="absolute right-4 top-4" />
          </DialogHeader>

          {/* Instructional Steps */}
          <div className="mt-6 flex flex-col items-start justify-center">
            <Collapsible
              open={isInstructionsOpen}
              onOpenChange={setIsInstructionsOpen}
            >
              <CollapsibleTrigger className="flex items-center gap-2">
                <h3 className="text-3xl">Instructions</h3>
                <ChevronDown
                  className={`h-6 w-6 transition-transform duration-200 ${
                    isInstructionsOpen ? "rotate-180" : ""
                  }`}
                />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <ol className="mt-2 max-w-4xl space-y-2">
                  <InstructionStep
                    number={1}
                    text="Read the description to make sure you know what the task is."
                  />
                  <InstructionStep
                    number={2}
                    text="Click the link in the Resources column to read more details and go to where the required materials are."
                  />
                  <InstructionStep
                    number={3}
                    text="Complete the tasks in order from top to bottom."
                  />
                  <InstructionStep
                    number={4}
                    text="If you have questions, ask your desk partner and teammates before you ask your teacher."
                  />
                  <InstructionStep
                    number={5}
                    text="When you finish a task, bring it to your teacher so they can check it."
                  />
                  <InstructionStep
                    number={6}
                    text={
                      <>
                        If your teacher thinks you are done, they will mark it
                        as complete. You need to refresh this page by clicking
                        the <RotateCw className="mb-1 inline h-4 w-4" /> button
                        or pressing F5.
                      </>
                    }
                  />
                </ol>
              </CollapsibleContent>
            </Collapsible>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px] whitespace-nowrap">
                    Name
                  </TableHead>
                  <TableHead className="w-[250px] whitespace-nowrap">
                    Description
                  </TableHead>
                  <TableHead className="w-[100px] whitespace-nowrap">
                    Resources
                  </TableHead>
                  <TableHead className="w-[150px] whitespace-nowrap">
                    Due Date
                  </TableHead>
                  <TableHead className="w-[150px] whitespace-nowrap">
                    Working Date
                  </TableHead>
                  <TableHead className="w-[150px] whitespace-nowrap">
                    Created Date
                  </TableHead>
                  <TableHead className="w-[150px] whitespace-nowrap">
                    Topic
                  </TableHead>
                  <TableHead className="w-[100px] whitespace-nowrap">
                    Complete
                  </TableHead>
                  <TableHead className="w-[150px] whitespace-nowrap">
                    Completed At
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignments.map((assignment) => (
                  <TableRow
                    key={assignment.sa_id}
                    className={`transition-colors hover:bg-blue-100 dark:hover:bg-blue-500 ${
                      assignment.sa_complete
                        ? "bg-green-200 dark:bg-green-600"
                        : "bg-red-200 dark:bg-red-600"
                    }`}
                  >
                    {/* Assignment Name */}
                    <TableCell>
                      <span className="font-bold text-gray-800 dark:text-gray-200">
                        {assignment.assignment_name}
                      </span>
                    </TableCell>
                    {/* Assignment Description */}
                    <TableCell className="text-gray-700 dark:text-gray-300">
                      {assignment.assignment_description ?? "—"}
                    </TableCell>
                    {/* Assignment Data */}
                    <TableCell className="text-gray-700 dark:text-gray-300">
                      {assignment.assignment_data ? (
                        <a
                          href={assignment.assignment_data}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-500 underline"
                        >
                          View Data
                        </a>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    {/* Due Date */}
                    <TableCell className="text-gray-700 dark:text-gray-300">
                      {assignment.due_date
                        ? formatDate(assignment.due_date)
                        : "—"}
                    </TableCell>
                    {/* Working Date */}
                    <TableCell className="text-gray-700 dark:text-gray-300">
                      {assignment.working_date
                        ? formatDate(assignment.working_date)
                        : "—"}
                    </TableCell>
                    {/* Created Date */}
                    <TableCell className="text-gray-700 dark:text-gray-300">
                      {formatDate(assignment.created_date)}
                    </TableCell>
                    {/* Topic */}
                    <TableCell className="text-gray-700 dark:text-gray-300">
                      {assignment.topic ?? "—"}
                    </TableCell>
                    {/* Completion Status */}
                    <TableCell className="text-gray-700 dark:text-gray-300">
                      {assignment.sa_complete ? "✅ Yes" : "❌ No"}
                    </TableCell>
                    {/* Completed At */}
                    <TableCell className="text-gray-700 dark:text-gray-300">
                      {assignment.sa_completed_ts
                        ? formatDateTime(assignment.sa_completed_ts)
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog for Individual Assignment Details */}
      <Dialog
        open={selectedAssignment !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedAssignment(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedAssignment?.assignment_name}</DialogTitle>
            <DialogClose className="absolute right-4 top-4" />
          </DialogHeader>
          <div className="flex flex-col space-y-2 px-4 py-2">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              <strong>Description: </strong>
              {selectedAssignment?.assignment_description ?? "—"}
            </p>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              <strong>Resources: </strong>
              {selectedAssignment?.assignment_data ? (
                <a
                  href={selectedAssignment.assignment_data}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 underline"
                >
                  View Data
                </a>
              ) : (
                "—"
              )}
            </p>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              <strong>Due Date: </strong>
              {selectedAssignment?.due_date
                ? formatDate(selectedAssignment.due_date)
                : "—"}
            </p>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              <strong>Working Date: </strong>
              {selectedAssignment?.working_date
                ? formatDate(selectedAssignment.working_date)
                : "—"}
            </p>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              <strong>Created Date: </strong>
              {selectedAssignment
                ? formatDate(selectedAssignment.created_date)
                : "—"}
            </p>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              <strong>Topic: </strong>
              {selectedAssignment?.topic ?? "—"}
            </p>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              <strong>Completed: </strong>
              {selectedAssignment?.sa_complete ? "Yes" : "No"}
            </p>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              <strong>Completed At: </strong>
              {selectedAssignment?.sa_completed_ts
                ? formatDateTime(selectedAssignment.sa_completed_ts)
                : "—"}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AssignmentTable;
