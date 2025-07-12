// src/app/class/components/gradebook/CreateGradeScaleDialog.tsx
"use client";

import * as React from "react";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { HelpCircle, Trash2 } from "lucide-react";
import type { Grade } from "@/server/db/types";
import { v4 as uuidV4 } from "uuid";
import { useCreateGradeScale } from "./hooks/useCreateGradeScale";
import type { CreateGradeScaleArgs } from "./actions/createGradeScale";

interface CreateGradeScaleDialogProps {
  trigger: React.ReactNode;
}

export const CreateGradeScaleDialog: React.FC<CreateGradeScaleDialogProps> = ({
  trigger,
}) => {
  const [open, setOpen] = React.useState(false);
  const [scaleName, setScaleName] = React.useState("");
  const [grades, setGrades] = React.useState<Grade[]>([
    { id: uuidV4(), name: "", minPercentage: 0, maxPercentage: 100 },
  ]);

  const createMutation = useCreateGradeScale();
  const isPending = createMutation.isPending;

  const addGrade = () =>
    setGrades((g) => [
      ...g,
      { id: uuidV4(), name: "", minPercentage: 0, maxPercentage: 0 },
    ]);

  const removeGrade = (idx: number) =>
    setGrades((g) => g.filter((_, i) => i !== idx));

  const updateGrade = (
    idx: number,
    field: keyof Omit<Grade, "id">,
    value: string | number,
  ) =>
    setGrades((g) =>
      g.map((row, i) =>
        i === idx
          ? {
              ...row,
              [field]: typeof row[field] === "number" ? Number(value) : value,
            }
          : row,
      ),
    );

  const resetForm = () => {
    setScaleName("");
    setGrades([
      {
        id: uuidV4(),
        name: "",
        minPercentage: 0,
        maxPercentage: 100,
      },
    ]);
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: CreateGradeScaleArgs = { name: scaleName, grades };

    setOpen(false); // optimistic close

    createMutation.mutate(payload, {
      onSettled: resetForm,
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Grade Scale</DialogTitle>
          <DialogDescription>
            Name your scale and define your grade ranges.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-6">
          {/* Scale Name */}
          <div>
            <label className="mb-1 block font-medium">Scale Name</label>
            <Input
              value={scaleName}
              onChange={(e) => setScaleName(e.target.value)}
              placeholder="e.g. High-Distinction Scale"
              required
              disabled={isPending}
            />
          </div>

          {/* Grades & Ranges */}
          <div>
            <label className="mb-2 block font-medium">Grades & Ranges</label>
            <div className="text-muted-foreground mb-3 text-sm">
              Min/max percentages are exact.&nbsp;
              <Tooltip>
                <TooltipTrigger>
                  <HelpCircle size={14} />
                </TooltipTrigger>
                <TooltipContent className="max-w-sm">
                  <p>
                    Percentages will not be rounded. If your range is 90–100%, a
                    score of 89.9% will not qualify.
                  </p>
                </TooltipContent>
              </Tooltip>
            </div>

            {/* headers */}
            <div className="grid grid-cols-4 items-center gap-x-2 border-b pb-2 text-center text-sm font-medium">
              <div>Label</div>
              <div>Min. %</div>
              <div>Max. %</div>
              <div>Del</div>
            </div>

            {/* rows */}
            <div className="space-y-2">
              {grades.map((g, i) => (
                <div
                  key={g.id}
                  className="grid grid-cols-4 items-center gap-x-2"
                >
                  <Input
                    className="w-full"
                    placeholder="A, B, C…"
                    value={g.name}
                    onChange={(e) => updateGrade(i, "name", e.target.value)}
                    required
                    disabled={isPending}
                  />

                  <Input
                    type="number"
                    className="w-full"
                    min={0}
                    max={100}
                    step={1}
                    value={g.minPercentage}
                    onChange={(e) =>
                      updateGrade(i, "minPercentage", Number(e.target.value))
                    }
                    disabled={isPending}
                  />

                  <Input
                    type="number"
                    className="w-full"
                    min={0}
                    max={100}
                    step={1}
                    value={g.maxPercentage}
                    onChange={(e) =>
                      updateGrade(i, "maxPercentage", Number(e.target.value))
                    }
                    disabled={isPending}
                  />

                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => removeGrade(i)}
                    disabled={isPending}
                  >
                    <Trash2 />
                  </Button>
                </div>
              ))}

              <Button onClick={addGrade} size="sm" disabled={isPending}>
                + Add Grade
              </Button>
            </div>
          </div>

          <DialogFooter className="flex justify-end space-x-2">
            <DialogClose asChild>
              <Button variant="outline" disabled={isPending}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving..." : "Save Scale"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
