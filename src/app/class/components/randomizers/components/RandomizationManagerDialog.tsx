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
import { Eye, Edit, Shuffle, Trash2 } from "lucide-react";
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
import { RandomizationsOptions } from "@/app/api/queryOptions";
import { useDeleteRandomization } from "../hooks/useDeleteRandomization";
import { ViewRandomizationDialog } from "./ViewRandomizationDialog";
import { EditRandomizationDialog } from "./EditRandomizationDialog";

interface RandomizationManagerDialogProps {
  trigger: ReactNode;
  classId: string;
}

export function RandomizationManagerDialog({
  trigger,
  classId,
}: RandomizationManagerDialogProps) {
  const {
    data: randomizations,
    isLoading,
    isError,
  } = useQuery(RandomizationsOptions(classId));
  const { mutate: deleteRandomization, isPending: isDeleting } =
    useDeleteRandomization(classId);

  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="w-full max-w-lg">
        <DialogHeader>
          <DialogTitle>Manage Randomizations</DialogTitle>
          <DialogDescription>
            View, edit, or delete your saved randomizations for this class.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4">
          <h2 className="mb-2 text-lg font-semibold">Saved Randomizations</h2>

          {isLoading ? (
            <p>Loading…</p>
          ) : isError ? (
            <p>Error loading randomizations.</p>
          ) : !randomizations?.length ? (
            <p className="text-muted-foreground">
              No randomizations saved yet. Create one by using the student
              randomizer with a name.
            </p>
          ) : (
            <ul className="divide-y">
              {randomizations.map((randomization) => (
                <li
                  key={randomization.id}
                  className="flex items-center justify-between py-3"
                >
                  <div>
                    <span className="font-medium">{randomization.name}</span>
                    <p className="text-muted-foreground text-sm">
                      {randomization.students?.length ?? 0} students
                    </p>
                  </div>
                  <div className="flex space-x-2">
                    <ViewRandomizationDialog
                      mode="view"
                      randomization={randomization}
                      classId={classId}
                      trigger={
                        <Button size="sm" variant="outline">
                          <Eye size={16} />
                          <span className="ml-1 hidden sm:inline">View</span>
                        </Button>
                      }
                    />

                    <EditRandomizationDialog
                      randomization={randomization}
                      classId={classId}
                      trigger={
                        <Button size="sm" variant="outline">
                          <Edit size={16} />
                          <span className="ml-1 hidden sm:inline">Edit</span>
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
                          <span className="ml-1 hidden sm:inline">Delete</span>
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            Delete Randomization?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete the randomization{" "}
                            <span className="font-bold">
                              {randomization.name}
                            </span>{" "}
                            and all its associated data. This action cannot be
                            undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel asChild>
                            <Button variant="outline">Cancel</Button>
                          </AlertDialogCancel>
                          <AlertDialogAction asChild>
                            <Button
                              variant="destructive"
                              onClick={() =>
                                deleteRandomization(randomization.id)
                              }
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
