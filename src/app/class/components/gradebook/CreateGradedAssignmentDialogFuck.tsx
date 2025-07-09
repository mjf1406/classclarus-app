// src\app\class\components\gradebook\CreateGradedAssignmentDialog.tsx
"use client";

import * as React from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import type { SectionInput } from "./actions/createGradedAssignment";
import { useCreateGradedAssignment } from "./hooks/useCreateGradedAssignment";

interface SectionForm {
  name: string;
  points: number;
}

interface FormValues {
  name: string;
  sections: SectionForm[];
  totalPoints?: number;
}

interface Props {
  classId: string;
  trigger?: React.ReactNode;
  initialData?: {
    name: string;
    sections: SectionForm[];
    totalPoints?: number;
  };
}

export function CreateGradedAssignmentDialog({
  classId,
  trigger,
  initialData,
}: Props) {
  const [open, setOpen] = React.useState(false);
  const ctrlRef = React.useRef(false);

  // set up defaultValues based on initialData if provided
  const defaultValues: FormValues = initialData
    ? {
        name: initialData.name,
        sections: initialData.sections,
        totalPoints: initialData.totalPoints,
      }
    : { name: "", sections: [], totalPoints: undefined };

  const form = useForm<FormValues>({ defaultValues });
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "sections",
  });

  const sections = form.watch("sections");
  const computedTotal = sections.reduce((sum, s) => sum + (s.points || 0), 0);
  const hasSections = sections.length > 0;

  // record Ctrl+Enter
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && e.ctrlKey) ctrlRef.current = true;
  };
  // record Ctrl+Click
  const onClick = (e: React.MouseEvent) => {
    ctrlRef.current = e.ctrlKey;
  };

  const createMutation = useCreateGradedAssignment(classId);
  const isPending = createMutation.isPending;

  const onSubmit = form.handleSubmit((data) => {
    const keepOpen = ctrlRef.current;
    ctrlRef.current = false;

    const payload = {
      class_id: classId,
      name: data.name,
      total_points: hasSections ? computedTotal : (data.totalPoints ?? null),
      sections: data.sections.map(
        (s): SectionInput => ({ name: s.name, points: s.points }),
      ),
    };

    // close dialog immediately so the list updates optimistically
    if (!keepOpen) setOpen(false);

    createMutation.mutate(payload, {
      onError(err) {
        console.error("Failed to create", err);
      },
      onSettled: () => {
        // reset back to defaultValues (which are initialData or blank)
        form.reset();
        if (keepOpen) setOpen(true);
      },
    });
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button disabled={isPending}>
            {isPending ? "Creating..." : "Create Graded Assignment"}
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>
            {initialData
              ? "Duplicate Graded Assignment"
              : "Create Graded Assignment"}
          </DialogTitle>
          <DialogDescription>
            {initialData
              ? "Adjust and save your duplicated assignment."
              : "Define name, sections, total points."}
          </DialogDescription>
          <p className="mt-1 text-sm text-gray-500">
            Ctrl+Enter or Ctrl+Click to submit without closing.
          </p>
        </DialogHeader>

        <form onSubmit={onSubmit} onKeyDown={onKeyDown} className="grid gap-6">
          <div className="grid gap-1">
            <Label htmlFor="name">Assignment Name</Label>
            <Input
              id="name"
              placeholder="e.g. Midterm Exam"
              {...form.register("name", { required: true })}
              disabled={isPending}
            />
          </div>

          {hasSections ? (
            <div className="grid gap-4">
              <Label>Sections</Label>
              {fields.map((field, idx) => (
                <div key={field.id} className="flex items-end gap-2">
                  <div className="grid flex-1 gap-1">
                    <Label htmlFor={`sections.${idx}.name`}>Section Name</Label>
                    <Input
                      id={`sections.${idx}.name`}
                      placeholder="e.g. Problem Set"
                      {...form.register(`sections.${idx}.name`, {
                        required: true,
                      })}
                      disabled={isPending}
                    />
                  </div>

                  <div className="grid w-32 gap-1">
                    <Label htmlFor={`sections.${idx}.points`}>Points</Label>
                    <Input
                      id={`sections.${idx}.points`}
                      type="number"
                      {...form.register(`sections.${idx}.points`, {
                        required: true,
                        valueAsNumber: true,
                      })}
                      disabled={isPending}
                    />
                  </div>

                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    onClick={() => remove(idx)}
                    disabled={isPending}
                  >
                    ×
                  </Button>
                </div>
              ))}

              <Button
                type="button"
                variant="outline"
                onClick={() => append({ name: "", points: 0 })}
                disabled={isPending}
              >
                Add Section
              </Button>

              <div className="flex justify-between pt-2">
                <span className="font-medium">Total Points:</span>
                <span className="font-semibold">{computedTotal}</span>
              </div>
            </div>
          ) : (
            <div className="grid gap-4">
              <Label htmlFor="totalPoints">Total Points</Label>
              <Input
                id="totalPoints"
                type="number"
                placeholder="e.g. 100"
                {...form.register("totalPoints", {
                  required: true,
                  valueAsNumber: true,
                })}
                disabled={isPending}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => append({ name: "", points: 0 })}
                disabled={isPending}
              >
                Add Sections Instead
              </Button>
            </div>
          )}

          <DialogFooter>
            <Button type="submit" onClick={onClick} disabled={isPending}>
              {isPending
                ? "Creating..."
                : initialData
                  ? "Duplicate Assignment"
                  : "Create Graded Assignment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
