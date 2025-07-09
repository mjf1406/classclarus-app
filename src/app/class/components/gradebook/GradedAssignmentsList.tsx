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
import { useDeleteGradedAssignment } from "./hooks/useDeleteGradedAssignment";
import { Copy, Edit, Sigma, Trash2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import ScoreModal from "./ScoresModal";
import type { AssignmentScore } from "@/server/db/types";
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
      <div className="py-16 text-center text-sm text-gray-500">
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
  const deleteMutation = useDeleteGradedAssignment(a.class_id);
  const isDeleting = deleteMutation.isPending;

  const onConfirmDelete = () => {
    setAlertOpen(false);
    deleteMutation.mutate(a.id);
  };

  // prepare initialData for duplication
  const initialData = {
    name: a.name,
    sections: a.sections.map((s) => ({
      name: s.name,
      points: s.points,
    })),
    // only if no sections do we supply totalPoints
    totalPoints: a.sections.length ? undefined : (a.total_points ?? undefined),
  };

  return (
    <Card className="border">
      <CardContent className="space-y-4">
        <CardHeader className="flex items-start justify-between p-0">
          <div>
            <CardTitle>{a.name}</CardTitle>
            <CardDescription>
              Total Points:{" "}
              <span className="font-semibold">{a.total_points ?? "—"}</span>
            </CardDescription>
          </div>
          <div className="flex space-x-2">
            <ScoreModal
              classId={classId}
              assignment={a}
              trigger={
                <Button variant="outline" size="sm">
                  <Sigma /> Scores
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
                    Are you sure you want to delete “{a.name}”?
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
            <dd className="">{new Date(a.created_date).toLocaleString()}</dd>
          </div>
          <div>
            <dt className="font-medium">Updated</dt>
            <dd className="">{new Date(a.updated_date).toLocaleString()}</dd>
          </div>
        </dl>

        {a.sections.length > 0 && (
          <div>
            <h4 className="mb-2 font-medium">Sections</h4>
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
          </div>
        )}
      </CardContent>
    </Card>
  );
}
