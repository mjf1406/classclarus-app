// components/CreateReportDialog.tsx
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
import { GradedSubjectsOptions } from "@/app/api/queryOptions";
import { useCreateReport } from "./hooks/useCreateReportHook";
import type { CreateReportArgs } from "./actions/createReport";

interface FormValues {
  name: string;
  graded_subjects: string[];
}

type CreateReportDialogProps = {
  classId: string;
  trigger?: React.ReactNode;
};

export function CreateReportDialog({
  classId,
  trigger,
}: CreateReportDialogProps) {
  const [open, setOpen] = React.useState(false);
  const ctrlRef = React.useRef(false);

  const {
    data: gradedSubjects,
    isLoading,
    isError,
  } = useQuery(GradedSubjectsOptions(classId));

  const createMutation = useCreateReport(classId);
  const isPending = createMutation.isPending;

  const form = useForm<FormValues>({
    defaultValues: { name: "", graded_subjects: [] },
  });
  const { control, register, handleSubmit, reset } = form;

  // record Ctrl+Enter
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && e.ctrlKey) ctrlRef.current = true;
  };
  // record Ctrl+Click
  const onClick = (e: React.MouseEvent) => {
    ctrlRef.current = e.ctrlKey;
  };

  const onSubmit = handleSubmit((data) => {
    const keepOpen = ctrlRef.current;
    ctrlRef.current = false;

    const payload: CreateReportArgs = {
      class_id: classId,
      name: data.name,
      graded_subjects: data.graded_subjects,
    };

    // close immediately for optimistic UI
    if (!keepOpen) setOpen(false);

    createMutation.mutate(payload, {
      onError(err) {
        console.error("Failed to create report", err);
      },
      onSettled() {
        reset();
        if (keepOpen) setOpen(true);
      },
    });
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button disabled={isPending}>
            {isPending ? "Creating…" : "Create Report"}
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Create Report</DialogTitle>
          <DialogDescription>
            Name your report and choose which graded subjects to include.
          </DialogDescription>
          <p className="mt-1 text-sm text-gray-500">
            Ctrl+Enter or Ctrl+Click to submit without closing.
          </p>
        </DialogHeader>

        <form onSubmit={onSubmit} onKeyDown={onKeyDown} className="grid gap-6">
          <div className="grid gap-1">
            <Label htmlFor="name">Report Name</Label>
            <Input
              id="name"
              {...register("name", { required: true })}
              disabled={isPending}
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
                        id={`subj-${subj.id}`}
                        checked={field.value.includes(subj.id)}
                        disabled={isPending}
                        onCheckedChange={(checked) => {
                          const next = checked
                            ? [...field.value, subj.id]
                            : field.value.filter((id) => id !== subj.id);
                          field.onChange(next);
                        }}
                      />
                      <Label htmlFor={`subj-${subj.id}`}>{subj.name}</Label>
                    </div>
                  )}
                />
              ))
            )}
          </fieldset>

          <DialogFooter>
            <Button type="submit" onClick={onClick} disabled={isPending}>
              {isPending ? "Creating…" : "Create Report"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
