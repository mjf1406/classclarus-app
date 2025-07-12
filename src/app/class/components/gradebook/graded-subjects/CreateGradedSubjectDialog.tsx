// src/app/class/components/gradebook/CreateGradedSubjectDialog.tsx
"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronUp } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

import { GradeScaleOptions } from "@/app/api/queryOptions";
import { useCreateGradedSubject } from "./hooks/useCreateGradedSubject";
import type { Assignment } from "../graded-assignments/GradedAssignmentsList";

interface CreateGradedSubjectDialogProps {
  classId: string;
  trigger: React.ReactNode;
  assignments: Assignment[];
}

type GradeScale = { id: string; name: string };

export const CreateGradedSubjectDialog: React.FC<
  CreateGradedSubjectDialogProps
> = ({ classId, trigger, assignments }) => {
  // control open/close
  const [open, setOpen] = React.useState(false);

  // form state
  const [subjectName, setSubjectName] = React.useState("");
  const [selectedGradeScaleId, setSelectedGradeScaleId] =
    React.useState<string>();
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());
  const [selAIds, setSelAIds] = React.useState<Set<string>>(new Set());
  const [selSIds, setSelSIds] = React.useState<Set<string>>(new Set());

  // fetch scales
  const { data: gradeScales = [] } = useQuery(GradeScaleOptions());

  // mutation hook
  const { mutate: createSubject, isPending } = useCreateGradedSubject(classId);

  // toggles (same as before) …
  const toggleExpand = (aid: string) => {
    const next = new Set(expanded);
    if (next.has(aid)) next.delete(aid);
    else next.add(aid);
    setExpanded(next);
  };

  const handleToggleAssignment = (a: Assignment) => {
    const nextA = new Set(selAIds);
    const nextS = new Set(selSIds);
    if (nextA.has(a.id)) {
      nextA.delete(a.id);
      a.sections?.forEach((s) => nextS.delete(s.id));
    } else {
      nextA.add(a.id);
      a.sections?.forEach((s) => nextS.add(s.id));
    }
    setSelAIds(nextA);
    setSelSIds(nextS);
  };

  const handleToggleSection = (a: Assignment, sid: string) => {
    const nextS = new Set(selSIds);
    if (nextS.has(sid)) nextS.delete(sid);
    else nextS.add(sid);

    const allChild = a.sections?.map((s) => s.id) ?? [];
    const parentChecked = allChild.every((id) => nextS.has(id));
    const nextA = new Set(selAIds);
    if (parentChecked) nextA.add(a.id);
    else nextA.delete(a.id);

    setSelSIds(nextS);
    setSelAIds(nextA);
  };

  // onSubmit: optimistic update + close dialog
  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGradeScaleId) return;

    createSubject({
      class_id: classId,
      name: subjectName,
      default_grade_scale: selectedGradeScaleId,
      graded_assignment_ids: Array.from(selAIds),
      section_ids: Array.from(selSIds),
    });

    // close immediately on optimistic update
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create Graded Subject</DialogTitle>
          <DialogDescription>
            Name your subject, pick a grade scale, and assign
            assignments/sections.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-6">
          {/* Subject Name */}
          <div>
            <Label htmlFor="subjectName">Subject Name</Label>
            <Input
              id="subjectName"
              value={subjectName}
              onChange={(e) => setSubjectName(e.target.value)}
              placeholder="e.g. Grammar"
              required
            />
          </div>

          {/* Grade Scale */}
          <div>
            <Label htmlFor="gradeScaleTrigger">Grade Scale</Label>
            <Select
              value={selectedGradeScaleId}
              onValueChange={setSelectedGradeScaleId}
            >
              <SelectTrigger id="gradeScaleTrigger" className="w-full">
                <SelectValue placeholder="Select grade scale…" />
              </SelectTrigger>
              <SelectContent>
                {gradeScales.map((gs: GradeScale) => (
                  <SelectItem key={gs.id} value={gs.id}>
                    {gs.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Assignments & Sections */}
          <div>
            <Label>Assignments & Sections</Label>
            <div className="max-h-60 space-y-2 overflow-y-auto rounded border p-2">
              {assignments.map((a) => (
                <Collapsible
                  key={a.id}
                  open={expanded.has(a.id)}
                  onOpenChange={() => toggleExpand(a.id)}
                >
                  <div className="flex items-center">
                    <div className="flex items-center">
                      <Checkbox
                        id={`assignment-${a.id}`}
                        checked={selAIds.has(a.id)}
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
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </Button>
                      </CollapsibleTrigger>
                    ) : null}
                  </div>

                  {a.sections?.length ? (
                    <CollapsibleContent className="mt-2 ml-6 space-y-2">
                      {a.sections.map((s) => (
                        <div key={s.id} className="flex items-center">
                          <Checkbox
                            id={`section-${s.id}`}
                            checked={selSIds.has(s.id)}
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
                  ) : null}
                </Collapsible>
              ))}
            </div>
          </div>

          <DialogFooter className="flex justify-end space-x-2">
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Creating…" : "Create Graded Subject"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
