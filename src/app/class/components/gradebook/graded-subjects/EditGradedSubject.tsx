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
import { useUpdateGradedSubject } from "./hooks/useUpdateGradedSubject";
import type { GradedSubject } from "@/server/db/types";
import type { Assignment } from "../graded-assignments/GradedAssignmentsList";
import { useAuth } from "@clerk/nextjs";

interface EditGradedSubjectDialogProps {
  subject: GradedSubject;
  assignments: Assignment[];
  trigger: React.ReactNode;
}

type GradeScale = { id: string; name: string };

export function EditGradedSubjectDialog({
  subject,
  assignments,
  trigger,
}: EditGradedSubjectDialogProps) {
  const [open, setOpen] = React.useState(false);
  const { userId } = useAuth();
  if (!userId) throw new Error("Not authenticated");

  // form state
  const [name, setName] = React.useState("");
  const [selectedScale, setSelectedScale] = React.useState<string>();
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());
  const [selA, setSelA] = React.useState<Set<string>>(new Set());
  const [selS, setSelS] = React.useState<Set<string>>(new Set());

  // fetch grade scales
  const { data: scales = [] } = useQuery(GradeScaleOptions(userId));

  // mutation
  const { mutate: update, isPending } = useUpdateGradedSubject(
    subject.class_id,
  );

  // reset form each time we open
  React.useEffect(() => {
    if (open) {
      setName(subject.name);
      setSelectedScale(subject.default_grade_scale ?? "");
      setSelA(new Set(subject.graded_assignment_ids));
      setSelS(new Set(subject.section_ids));
      setExpanded(new Set(subject.graded_assignment_ids));
    }
  }, [open, subject]);

  const toggleExpand = (aid: string) => {
    const nxt = new Set(expanded);
    if (nxt.has(aid)) nxt.delete(aid);
    else nxt.add(aid);
    setExpanded(nxt);
  };

  const toggleAssignment = (a: Assignment) => {
    const aSet = new Set(selA);
    const sSet = new Set(selS);
    if (aSet.has(a.id)) {
      aSet.delete(a.id);
      a.sections?.forEach((s) => sSet.delete(s.id));
    } else {
      aSet.add(a.id);
      a.sections?.forEach((s) => sSet.add(s.id));
    }
    setSelA(aSet);
    setSelS(sSet);
  };

  const toggleSection = (a: Assignment, sid: string) => {
    const sSet = new Set(selS);
    if (sSet.has(sid)) sSet.delete(sid);
    else sSet.add(sid);

    const allIds = a.sections?.map((s) => s.id) ?? [];
    const parentChecked = allIds.every((id) => sSet.has(id));
    const aSet = new Set(selA);
    if (parentChecked) aSet.add(a.id);
    else aSet.delete(a.id);

    setSelS(sSet);
    setSelA(aSet);
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedScale) return;
    update({
      id: subject.id,
      class_id: subject.class_id,
      name,
      default_grade_scale: selectedScale,
      graded_assignment_ids: Array.from(selA),
      section_ids: Array.from(selS),
    });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit Graded Subject</DialogTitle>
          <DialogDescription>
            Update name, grade scale, or assigned assignments/sections.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-6">
          <div>
            <Label htmlFor="editSubjectName">Subject Name</Label>
            <Input
              id="editSubjectName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div>
            <Label htmlFor="editScaleTrigger">Grade Scale</Label>
            <Select value={selectedScale} onValueChange={setSelectedScale}>
              <SelectTrigger id="editScaleTrigger" className="w-full">
                <SelectValue placeholder="Select grade scale…" />
              </SelectTrigger>
              <SelectContent>
                {scales.map((gs: GradeScale) => (
                  <SelectItem key={gs.id} value={gs.id}>
                    {gs.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

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
                    <Checkbox
                      id={`edit-assn-${a.id}`}
                      checked={selA.has(a.id)}
                      onCheckedChange={() => toggleAssignment(a)}
                    />
                    <Label
                      htmlFor={`edit-assn-${a.id}`}
                      className="ml-2 cursor-pointer font-medium"
                    >
                      {a.name}
                    </Label>
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
                    ) : (
                      ""
                    )}
                  </div>
                  {a.sections?.length ? (
                    <CollapsibleContent className="mt-2 ml-6 space-y-2">
                      {a.sections.map((s) => (
                        <div key={s.id} className="flex items-center">
                          <Checkbox
                            id={`edit-sec-${s.id}`}
                            checked={selS.has(s.id)}
                            onCheckedChange={() => toggleSection(a, s.id)}
                          />
                          <Label
                            htmlFor={`edit-sec-${s.id}`}
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
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving…" : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
