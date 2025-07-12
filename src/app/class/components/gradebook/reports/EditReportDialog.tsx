// components/EditReportDialog.tsx
"use client";

import * as React from "react";
import { useForm, Controller } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { GradedSubjectsOptions } from "@/app/api/queryOptions";
import type { UpdateReportArgs } from "./actions/updateReport";
import type { Report } from "@/server/db/types";
import { useUpdateReport } from "./hooks/useUpdateReportHook";

interface FormValues {
  name: string;
  graded_subjects: string[];
}

interface EditReportDialogProps {
  classId: string;
  report: Report;
  trigger?: React.ReactNode;
}

export default function EditReportDialog({
  classId,
  report,
  trigger,
}: EditReportDialogProps) {
  const [open, setOpen] = React.useState(false);

  const updateMutation = useUpdateReport(classId);
  const isUpdating = updateMutation.isPending; // or isPending in v5

  const form = useForm<FormValues>({
    defaultValues: {
      name: report.name,
      graded_subjects: report.graded_subjects,
    },
  });

  const { control, register, handleSubmit, reset } = form;

  // when dialog opens, reset to the latest props
  React.useEffect(() => {
    if (open) {
      reset({
        name: report.name,
        graded_subjects: report.graded_subjects,
      });
    }
  }, [open, report, reset]);

  const {
    data: gradedSubjects,
    isLoading,
    isError,
  } = useQuery(GradedSubjectsOptions(classId));

  const onSubmit = (data: FormValues) => {
    const payload: UpdateReportArgs = {
      id: report.id,
      class_id: classId,
      name: data.name,
      graded_subjects: data.graded_subjects,
    };

    // 1) close immediately for optimistic UI
    setOpen(false);

    // 2) fire the mutation
    updateMutation.mutate(payload, {
      onError(err) {
        // if it fails, re-open and show a toast
        console.error(err);
        toast.error("Failed to update report, please try again.");
        setOpen(true);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm" disabled={isUpdating}>
            {isUpdating ? "Saving…" : "Edit"}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Edit Report</DialogTitle>
          <DialogDescription>
            Update the report name or which graded subjects are included.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-6">
          <div className="grid gap-1">
            <Label htmlFor="name">Report Name</Label>
            <Input
              id="name"
              {...register("name", { required: true })}
              disabled={isUpdating}
            />
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Graded Subjects</legend>
            {isLoading ? (
              <div>Loading subjects…</div>
            ) : isError ? (
              <div>Error loading subjects</div>
            ) : (
              gradedSubjects?.map((subj) => (
                <Controller
                  key={subj.id}
                  control={control}
                  name="graded_subjects"
                  render={({ field }) => (
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id={`edit-subj-${subj.id}`}
                        checked={field.value.includes(subj.id)}
                        disabled={isUpdating}
                        onCheckedChange={(checked) => {
                          const next = checked
                            ? [...field.value, subj.id]
                            : field.value.filter((id) => id !== subj.id);
                          field.onChange(next);
                        }}
                      />
                      <Label htmlFor={`edit-subj-${subj.id}`}>
                        {subj.name}
                      </Label>
                    </div>
                  )}
                />
              ))
            )}
          </fieldset>

          <DialogFooter>
            <Button type="submit" disabled={isUpdating}>
              {isUpdating ? "Saving…" : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
