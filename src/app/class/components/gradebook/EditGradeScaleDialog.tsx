// src/app/class/components/gradebook/EditGradeScaleDialog.tsx
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
import { HelpCircle, Trash2, X } from "lucide-react";
import type { Grade } from "@/server/db/types";
import { useUpdateGradeScale } from "./hooks/useUpdateGradeScale";
import type { UpdateGradeScaleArgs } from "./actions/updateGradeScale";
import { v4 as uuidV4 } from "uuid";

interface EditGradeScaleDialogProps {
  trigger: React.ReactNode;
  scale: {
    id: string;
    name: string;
    grades: Grade[];
  };
}

export const EditGradeScaleDialog: React.FC<EditGradeScaleDialogProps> = ({
  trigger,
  scale,
}) => {
  const [open, setOpen] = React.useState(false);
  const [scaleName, setScaleName] = React.useState(scale.name);
  const [grades, setGrades] = React.useState<Grade[]>(scale.grades);

  const { mutate: save, isPending } = useUpdateGradeScale();

  // whenever we open, reset fields from the prop
  React.useEffect(() => {
    if (open) {
      setScaleName(scale.name);
      setGrades(scale.grades);
    }
  }, [open, scale]);

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

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: UpdateGradeScaleArgs = {
      id: scale.id,
      name: scaleName,
      grades,
    };
    setOpen(false); // optimistic close
    save(payload);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Grade Scale</DialogTitle>
          <DialogDescription>
            Change the name or grade ranges, then save.
          </DialogDescription>

          <DialogClose asChild>
            <Button
              variant="ghost"
              className="absolute top-4 right-4 p-2"
              disabled={isPending}
            >
              <X size={16} />
            </Button>
          </DialogClose>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-6 pt-4">
          {/* Scale Name */}
          <div>
            <label className="mb-1 block font-medium">Scale Name</label>
            <Input
              value={scaleName}
              onChange={(e) => setScaleName(e.target.value)}
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
                    Percentages won’t be rounded. If your range is 90–100%,
                    89.9% won’t qualify.
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
                      updateGrade(i, "minPercentage", e.target.value)
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
                      updateGrade(i, "maxPercentage", e.target.value)
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
              {isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
