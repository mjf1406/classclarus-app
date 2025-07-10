"use client";

import * as React from "react";
import { HelpCircle, Trash2 } from "lucide-react";
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
import { NumberInputWithStepper } from "@/components/NumberInputWithStepper";

export type Grade = {
  name: string;
  minPercentage: number;
  maxPercentage: number;
};

interface CreateGradeScaleDialogProps {
  trigger: React.ReactNode;
}

export const CreateGradeScaleDialog: React.FC<CreateGradeScaleDialogProps> = ({
  trigger,
}) => {
  const [scaleName, setScaleName] = React.useState("");
  const [grades, setGrades] = React.useState<Grade[]>([
    { name: "", minPercentage: 0, maxPercentage: 100 },
  ]);

  const addGrade = () =>
    setGrades((g) => [...g, { name: "", minPercentage: 0, maxPercentage: 0 }]);

  const removeGrade = (idx: number) =>
    setGrades((g) => g.filter((_, i) => i !== idx));

  const updateGrade = (
    idx: number,
    field: keyof Grade,
    value: string | number,
  ) => {
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
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      id: crypto.randomUUID(), // or let backend assign
      grades,
      name: scaleName,
    };
    console.log("Create Grade Scale payload:", payload);
    // TODO: POST to your API endpoint for grade_scale
  };

  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-lg">
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
                <div key={i} className="grid grid-cols-4 items-center gap-x-2">
                  <Input
                    className="w-full"
                    placeholder="A, B, C…"
                    value={g.name}
                    onChange={(e) => updateGrade(i, "name", e.target.value)}
                    required
                  />
                  <NumberInputWithStepper
                    value={g.minPercentage}
                    min={0}
                    max={100}
                    step={1}
                    onChange={(v) => updateGrade(i, "minPercentage", v)}
                    className="w-full"
                  />
                  <NumberInputWithStepper
                    value={g.maxPercentage}
                    min={0}
                    max={100}
                    step={1}
                    onChange={(v) => updateGrade(i, "maxPercentage", v)}
                    className="w-full"
                  />
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => removeGrade(i)}
                  >
                    <Trash2 />
                  </Button>
                </div>
              ))}
              <Button size="sm" onClick={addGrade}>
                + Add Grade
              </Button>
            </div>
          </div>

          <DialogFooter className="flex justify-end space-x-2">
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button type="submit">Save Scale</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
