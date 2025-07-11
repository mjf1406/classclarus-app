import React, { type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Edit, Tag, Trash2 } from "lucide-react";

import { CreateGradedSubjectDialog } from "./CreateGradedSubjectDialog";
import { GradedSubjectsOptions } from "@/app/api/queryOptions";
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
import { useDeleteGradedSubject } from "./hooks/useDeleteGradedSubject";
import { EditGradedSubjectDialog } from "./EditGradedSubject";
import type { Assignment } from "./GradedAssignmentsList";

interface GradedSubjectManagerDialogProps {
  trigger: ReactNode;
  classId: string;
  assignments: Assignment[];
}

export function GradedSubjectManagerDialog({
  trigger,
  classId,
  assignments,
}: GradedSubjectManagerDialogProps) {
  const {
    data: subjects,
    isLoading,
    isError,
  } = useQuery(GradedSubjectsOptions(classId));
  const { mutate: deleteSubject, isPending: isDeleting } =
    useDeleteGradedSubject(classId);

  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="w-full max-w-lg">
        <DialogHeader>
          <DialogTitle>Manage Graded Subjects</DialogTitle>
          <DialogDescription>
            Create, edit, or delete your graded subjects for this class.
          </DialogDescription>
        </DialogHeader>

        <CreateGradedSubjectDialog
          classId={classId}
          assignments={assignments}
          trigger={
            <Button variant="secondary">
              <Tag />{" "}
              <span className="hidden sm:block">Create Graded Subject</span>
            </Button>
          }
        />

        <div className="mt-6">
          <h2 className="mb-2 text-lg font-semibold">Existing Subjects</h2>

          {isLoading ? (
            <p>Loading…</p>
          ) : isError ? (
            <p>Error loading subjects.</p>
          ) : (
            <ul className="divide-y">
              {subjects!.map((subj) => (
                <li
                  key={subj.id}
                  className="flex items-center justify-between py-2"
                >
                  <span>{subj.name}</span>
                  <div className="flex space-x-2">
                    <EditGradedSubjectDialog
                      subject={subj}
                      assignments={assignments}
                      trigger={
                        <Button size="sm" variant="outline">
                          <Edit size={16} />
                          <span className="ml-1">Edit</span>
                        </Button>
                      }
                    />

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={isDeleting}
                        >
                          <Trash2 size={16} />
                          <span className="ml-1">Delete</span>
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Subject?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Deleting a Graded Subject does not affect any data
                            that is used by other features, however it does
                            remove the option of using it when exporting
                            computed grades. This action is irreversible. Are
                            you sure you want to delete the Graded Subject{" "}
                            <span className="font-bold">{subj.name}</span>?
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel asChild>
                            <Button variant="outline">Cancel</Button>
                          </AlertDialogCancel>
                          <AlertDialogAction asChild>
                            <Button
                              variant="destructive"
                              onClick={() => deleteSubject(subj.id)}
                            >
                              Delete
                            </Button>
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
