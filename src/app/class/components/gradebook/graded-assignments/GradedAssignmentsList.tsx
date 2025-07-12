// app/components/GradedAssignmentsList.tsx
"use client";

import React, { useState } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import EditGradedAssignmentDialog from "./EditGradedAssignmentDialog";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { ChevronUp, Copy, Edit, Sigma, Trash2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";

import type { AssignmentScore } from "@/server/db/types";
import { useQuery } from "@tanstack/react-query";
import { ClassByIdOptions } from "@/app/api/queryOptions";
import { useDeleteGradedAssignment } from "./hooks/useDeleteGradedAssignment";
import ScoresModal from "../score-modal/ScoresModal";
import { CreateGradedAssignmentDialog } from "./CreateGradedAssignmentDialogFuck";

export interface Section {
  id: string;
  name: string;
  points: number;
  scores: AssignmentScore[];
}

export interface Assignment {
  id: string;
  user_id: string;
  class_id: string;
  name: string;
  total_points: number | null;
  created_date: string;
  updated_date: string;
  sections: Section[];
  scores: AssignmentScore[];
}

interface GradedAssignmentsListProps {
  assignments: Assignment[];
  classId: string | null;
}

export default function GradedAssignmentsList({
  assignments,
  classId,
}: GradedAssignmentsListProps) {
  if (assignments.length === 0) {
    return (
      <div className="text-muted-foreground py-16 text-center text-sm">
        No graded assignments found.
      </div>
    );
  }
  return (
    <div className="space-y-6">
      {assignments.map((a) => (
        <AssignmentCard key={a.id} assignment={a} classId={classId} />
      ))}
    </div>
  );
}

function AssignmentCard({
  assignment: a,
  classId,
}: {
  assignment: Assignment;
  classId: string | null;
}) {
  const [alertOpen, setAlertOpen] = useState(false);
  const [sectionsOpen, setSectionsOpen] = useState(false);
  const deleteMutation = useDeleteGradedAssignment(a.class_id);
  const isDeleting = deleteMutation.isPending;
  const { data: classDetail } = useQuery(ClassByIdOptions(classId));

  // total number of enrolled students
  const totalStudents = classDetail?.studentInfo.length ?? 0;

  // number of unique students who have at least one score recorded
  const gradedStudents = React.useMemo(() => {
    return new Set(a.scores.map((s) => s.student_id)).size;
  }, [a.scores]);

  const onConfirmDelete = () => {
    setAlertOpen(false);
    deleteMutation.mutate(a.id);
  };

  // prepare initial data for duplication
  const initialData = {
    name: a.name,
    sections: a.sections.map((s) => ({
      name: s.name,
      points: s.points,
    })),
    totalPoints:
      a.sections.length > 0 ? undefined : (a.total_points ?? undefined),
  };

  return (
    <Card className="border">
      <CardContent className="space-y-4">
        <CardHeader className="flex items-start justify-between p-0">
          <div>
            <CardTitle>{a.name}</CardTitle>
            <CardDescription>
              <div>
                Graded:{" "}
                <span className="font-semibold">
                  {gradedStudents} / {totalStudents}
                </span>
              </div>
            </CardDescription>
          </div>
          <div className="flex items-center space-x-2">
            <ScoresModal
              classId={classId}
              assignment={a}
              trigger={
                <Button variant="secondary" size="sm">
                  <Sigma /> <span className="hidden sm:block">Scores</span>
                </Button>
              }
            />
            <EditGradedAssignmentDialog
              classId={a.class_id}
              assignment={a}
              trigger={
                <Button variant="outline" size="sm">
                  <Edit /> <span className="hidden md:block">Edit</span>
                </Button>
              }
            />
            <CreateGradedAssignmentDialog
              classId={a.class_id}
              trigger={
                <Button variant="outline" size="sm">
                  <Copy /> <span className="hidden md:block">Duplicate</span>
                </Button>
              }
              initialData={initialData}
            />
            <AlertDialog open={alertOpen} onOpenChange={setAlertOpen}>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 /> <span className="hidden md:block">Delete</span>
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Assignment?</AlertDialogTitle>
                  <AlertDialogDescription>
                    All data associated with this assignment, including sections
                    and student scores, will be deleted permanently. This action
                    is irreversible. Delete{" "}
                    <span className="font-bold">{a.name}</span>?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="flex justify-end space-x-2">
                  <AlertDialogCancel asChild>
                    <Button variant="outline">Cancel</Button>
                  </AlertDialogCancel>
                  <AlertDialogAction asChild>
                    <Button
                      variant="destructive"
                      disabled={isDeleting}
                      onClick={onConfirmDelete}
                    >
                      {isDeleting ? "Deleting..." : "Delete"}
                    </Button>
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardHeader>

        <Separator />

        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="font-medium">Created</dt>
            <dd>{new Date(a.created_date).toLocaleString()}</dd>
          </div>
          <div>
            <dt className="font-medium">Updated</dt>
            <dd>{new Date(a.updated_date).toLocaleString()}</dd>
          </div>
        </dl>

        <Collapsible open={sectionsOpen} onOpenChange={setSectionsOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm">
              <span>Section{a.sections.length !== 1 ? "s" : ""}:</span>
              <span className="font-semibold">{a.sections.length}</span>
              <ChevronUp
                className={`h-4 w-4 transition-transform duration-200 ${
                  sectionsOpen ? "rotate-180" : "rotate-0"
                }`}
              />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-2 pt-2">
            {a.sections.length > 0 ? (
              <div className="overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead className="text-right">Points</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {a.sections.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell>{s.name}</TableCell>
                        <TableCell className="text-right">{s.points}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-muted-foreground text-sm">
                There are no sections in this assignment.
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}
