"use client";

import * as React from "react";
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  HelpCircle,
  Minus,
  Plus,
  Trash2,
} from "lucide-react";
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
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import type { Assignment } from "./GradedAssignmentsList";
import { NumberInputWithStepper } from "@/components/NumberInputWithStepper";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Label } from "@/components/ui/label";

export type Grade = {
  name: string;
  minPercentage: number;
  maxPercentage: number;
};

interface CreateGradedSubjectDialogProps {
  classId: string;
  trigger: React.ReactNode;
  assignments: Assignment[];
}

export const CreateGradedSubjectDialog: React.FC<
  CreateGradedSubjectDialogProps
> = ({ classId, trigger, assignments }) => {
  // Form state
  const [subjectName, setSubjectName] = React.useState("");
  const [grades, setGrades] = React.useState<Grade[]>([
    { name: "", minPercentage: 0, maxPercentage: 100 },
  ]);
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());
  const [selectedAssignmentIds, setSelectedAssignmentIds] = React.useState<
    Set<string>
  >(new Set());
  const [selectedSectionIds, setSelectedSectionIds] = React.useState<
    Set<string>
  >(new Set());

  // Grade handlers
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

  // Assignment/section handlers
  const toggleExpand = (aid: string) => {
    const next = new Set(expanded);
    if (next.has(aid)) {
      next.delete(aid);
    } else {
      next.add(aid);
    }
    setExpanded(next);
  };

  const handleToggleAssignment = (a: Assignment) => {
    const nextA = new Set(selectedAssignmentIds);
    const nextS = new Set(selectedSectionIds);

    if (nextA.has(a.id)) {
      nextA.delete(a.id);
      a.sections?.forEach((s) => nextS.delete(s.id));
    } else {
      nextA.add(a.id);
      a.sections?.forEach((s) => nextS.add(s.id));
    }

    setSelectedAssignmentIds(nextA);
    setSelectedSectionIds(nextS);
  };

  const handleToggleSection = (a: Assignment, sid: string) => {
    const nextS = new Set(selectedSectionIds);
    if (nextS.has(sid)) {
      nextS.delete(sid);
    } else {
      nextS.add(sid);
    }

    const allChildIds = a.sections?.map((s) => s.id) ?? [];
    const parentChecked = allChildIds.every((id) => nextS.has(id));
    const nextA = new Set(selectedAssignmentIds);
    if (parentChecked) {
      nextA.add(a.id);
    } else {
      nextA.delete(a.id);
    }

    setSelectedSectionIds(nextS);
    setSelectedAssignmentIds(nextA);
  };

  // submit stub
  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      classId,
      name: subjectName,
      grades,
      graded_assignment_ids: Array.from(selectedAssignmentIds),
      section_ids: Array.from(selectedSectionIds),
    };
    console.log(">> create graded subject:", payload);
    // TODO: POST to your API
  };

  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create Graded Subject</DialogTitle>
          <DialogDescription>
            Name your subject, define grade ranges, and pick
            assignments/sections.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-6">
          {/* Subject Name */}
          <div>
            <label className="mb-1 block font-medium">Subject Name</label>
            <Input
              value={subjectName}
              onChange={(e) => setSubjectName(e.target.value)}
              placeholder="e.g. Grammar"
              required
            />
          </div>

          {/* Grades & Ranges */}
          <div>
            <label className="mb-2 block font-medium">Grades & Ranges</label>
            <div className="text-muted-foreground mb-3 text-sm">
              Percentages will not be rounded.{" "}
              <Tooltip>
                <TooltipTrigger>
                  <HelpCircle size={14} className="" />
                </TooltipTrigger>
                <TooltipContent className="max-w-lg">
                  <p>
                    For example, if a grade has a range of 90-100%, and a
                    student has a grade of 89.9%, then the student does not meet
                    the requirements of the 90-100% grade because their grade is
                    still technically 89%.
                  </p>
                </TooltipContent>
              </Tooltip>
            </div>

            {/* column headers */}
            <div className="grid grid-cols-4 items-center gap-x-2 border-b pb-2 text-center text-sm font-medium">
              <div>Label</div>
              <div>Min. %</div>
              <div>Max. %</div>
              <div>Del</div>
            </div>

            {/* grade rows */}
            <div className="space-y-2">
              {grades.map((g, i) => (
                <div key={i} className="grid grid-cols-4 items-center gap-x-2">
                  {/* Label */}
                  <Input
                    className="w-full"
                    placeholder="A, B, C…"
                    value={g.name}
                    onChange={(e) => updateGrade(i, "name", e.target.value)}
                    required
                  />

                  {/* Min. % */}
                  <NumberInputWithStepper
                    value={g.minPercentage}
                    min={0}
                    max={100}
                    step={1}
                    onChange={(v) => updateGrade(i, "minPercentage", v)}
                    className="w-full"
                  />

                  {/* Max. % */}
                  <NumberInputWithStepper
                    value={g.maxPercentage}
                    min={0}
                    max={100}
                    step={1}
                    onChange={(v) => updateGrade(i, "maxPercentage", v)}
                    className="w-full"
                  />

                  {/* Remove */}
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

          {/* Assignments & Sections */}
          <div>
            <label className="mb-2 block font-medium">
              Assignments & Sections
            </label>
            <div className="max-h-60 space-y-2 overflow-y-auto rounded border p-2">
              {assignments.map((a) => (
                <Collapsible
                  open={expanded.has(a.id)}
                  onOpenChange={() => toggleExpand(a.id)}
                  key={a.id}
                >
                  <div className="flex items-center">
                    <div className="flex">
                      <Checkbox
                        id={`assignment-${a.id}`}
                        checked={selectedAssignmentIds.has(a.id)}
                        onCheckedChange={() => handleToggleAssignment(a)}
                      />
                      <Label
                        htmlFor={`assignment-${a.id}`}
                        className="ml-2 cursor-pointer font-medium"
                      >
                        {a.name}
                      </Label>
                    </div>

                    {a.sections?.length ? (
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="icon">
                          {expanded.has(a.id) ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronUp className="h-4 w-4" />
                          )}
                        </Button>
                      </CollapsibleTrigger>
                    ) : (
                      ""
                    )}
                  </div>

                  {a.sections?.length ? (
                    <CollapsibleContent className="mt-2 ml-6 space-y-2">
                      {a.sections.map((s) => (
                        <div key={s.id} className="flex items-center">
                          <Checkbox
                            id={`section-${s.id}`}
                            checked={selectedSectionIds.has(s.id)}
                            onCheckedChange={() => handleToggleSection(a, s.id)}
                          />
                          <Label
                            htmlFor={`section-${s.id}`}
                            className="ml-2 cursor-pointer"
                          >
                            {s.name}
                          </Label>
                        </div>
                      ))}
                    </CollapsibleContent>
                  ) : (
                    ""
                  )}
                </Collapsible>
              ))}
            </div>
          </div>

          <DialogFooter className="flex justify-end space-x-2">
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button type="submit">Save Subject</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
