// src/app/class/components/gradebook/GradeScaleManagerDialog.tsx
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
import { Edit, Scale, Trash2 } from "lucide-react";

import { CreateGradeScaleDialog } from "./CreateGradeScaleDialog";
import { EditGradeScaleDialog } from "./EditGradeScaleDialog";
import { GradeScaleOptions } from "@/app/api/queryOptions";
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
import { useDeleteGradeScale } from "./hooks/useDeleteGradeScale";
import { useAuth } from "@clerk/nextjs";

interface GradeScaleManagerDialogProps {
  trigger: ReactNode;
}

export function GradeScaleManagerDialog({
  trigger,
}: GradeScaleManagerDialogProps) {
  const { userId } = useAuth();
  if (!userId) throw new Error("Not authenticated");
  const {
    data: gradeScales,
    isLoading,
    isError,
  } = useQuery(GradeScaleOptions(userId));
  const { mutate: deleteScale, isPending: isDeleting } = useDeleteGradeScale();

  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="w-full max-w-md">
        <DialogHeader>
          <DialogTitle>Manage Grade Scales</DialogTitle>
          <DialogDescription>
            Create new Grade Scales, or edit/delete existing ones.
          </DialogDescription>
        </DialogHeader>

        <CreateGradeScaleDialog
          trigger={
            <Button variant="secondary">
              <Scale size={16} />
              <span className="ml-2 hidden sm:block">Create Grade Scale</span>
            </Button>
          }
        />

        <div className="mt-6">
          <h2 className="mb-2 text-lg font-semibold">My Grade Scales</h2>

          {isLoading ? (
            <p>Loading grade scales...</p>
          ) : isError ? (
            <p>Failed to load grade scales.</p>
          ) : (
            <ul className="divide-y">
              {gradeScales!.map((scale) => (
                <li
                  key={scale.id}
                  className="flex items-center justify-between py-2"
                >
                  <span>{scale.name}</span>
                  <div className="flex space-x-2">
                    <EditGradeScaleDialog
                      scale={scale}
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
                          <AlertDialogTitle>
                            Delete Grade Scale?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            Deleting a Grade Scale does not affect any data that
                            is used by other features, however it does remove
                            the option of using the Grade Scale when exporting
                            computed grades. This action is irreversible. Are
                            you sure you want to delete the Grade Scale{" "}
                            <span className="font-bold">{scale.name}</span>?
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel asChild>
                            <Button variant="outline">Cancel</Button>
                          </AlertDialogCancel>
                          <AlertDialogAction asChild>
                            <Button
                              variant="destructive"
                              onClick={() => deleteScale(scale.id)}
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
