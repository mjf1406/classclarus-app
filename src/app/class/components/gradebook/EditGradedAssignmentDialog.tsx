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
import { useUpdateGradedAssignment } from "@/app/class/components/gradebook/hooks/useUpdateGradedAssignment";
import { type UpdateGradedAssignmentArgs } from "./actions/updateGradedAssignment";
import type { SectionInput } from "./actions/createGradedAssignment";

interface SectionForm {
  name: string;
  points: number;
}

interface FormValues {
  name: string;
  sections: SectionForm[];
  totalPoints?: number;
}

interface EditGradedAssignmentDialogProps {
  classId: string;
  assignment: {
    id: string;
    name: string;
    total_points: number | null;
    created_date: string;
    updated_date: string;
    sections: { id: string; name: string; points: number }[];
  };
  trigger?: React.ReactNode;
}

export default function EditGradedAssignmentDialog({
  classId,
  assignment,
  trigger,
}: EditGradedAssignmentDialogProps) {
  const [open, setOpen] = React.useState(false);
  const updateMutation = useUpdateGradedAssignment(classId);
  const isUpdating = updateMutation.isPending;

  const defaultSections = assignment.sections.map((s) => ({
    name: s.name,
    points: s.points,
  }));

  const form = useForm<FormValues>({
    defaultValues: {
      name: assignment.name,
      sections: defaultSections,
      totalPoints:
        defaultSections.length === 0
          ? (assignment.total_points ?? undefined)
          : undefined,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "sections",
  });

  const sections = form.watch("sections");
  const computedTotal = sections.reduce(
    (sum, sec) => sum + (sec.points || 0),
    0,
  );
  const hasSections = sections.length > 0;

  const onSubmit = form.handleSubmit((data) => {
    const payload: UpdateGradedAssignmentArgs = {
      id: assignment.id,
      class_id: classId,
      name: data.name,
      total_points: hasSections ? computedTotal : (data.totalPoints ?? null),
      sections: data.sections.map<SectionInput>((s) => ({
        name: s.name,
        points: s.points,
      })),
    };

    // close dialog immediately so the UI updates optimistically
    setOpen(false);

    updateMutation.mutate(payload, {
      onError(err) {
        console.error("Failed to update assignment", err);
      },
    });
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm" disabled={isUpdating}>
            {isUpdating ? "Saving..." : "Edit"}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Edit Graded Assignment</DialogTitle>
          <DialogDescription>
            Update the name, sections, and total points.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="grid gap-6">
          <div className="grid gap-1">
            <Label htmlFor="name">Assignment Name</Label>
            <Input
              id="name"
              {...form.register("name", { required: true })}
              disabled={isUpdating}
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
                      {...form.register(`sections.${idx}.name`, {
                        required: true,
                      })}
                      disabled={isUpdating}
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
                      disabled={isUpdating}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    onClick={() => remove(idx)}
                    disabled={isUpdating}
                  >
                    ×
                  </Button>
                </div>
              ))}

              <Button
                type="button"
                variant="outline"
                onClick={() => append({ name: "", points: 0 })}
                disabled={isUpdating}
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
                {...form.register("totalPoints", {
                  required: true,
                  valueAsNumber: true,
                })}
                disabled={isUpdating}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => append({ name: "", points: 0 })}
                disabled={isUpdating}
              >
                Add Sections Instead
              </Button>
            </div>
          )}

          <DialogFooter>
            <Button type="submit" disabled={isUpdating}>
              {isUpdating ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
