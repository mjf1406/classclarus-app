"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowUp, ArrowDown } from "lucide-react";

import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";

import type { ClassDetail, StudentClassWithStudent } from "@/server/db/types";
import { ClassByIdOptions } from "@/app/api/queryOptions";
import { useUpdateStudentScore } from "./hooks/useUpdateStudentScore";
import type { Assignment } from "./GradedAssignmentsList";
import { NumberInputWithStepper } from "@/components/NumberInputWithStepper";
import { Checkbox } from "@/components/ui/checkbox";

type SortKey = "student_number" | "first_name" | "last_name" | "percentage";

interface ScoresModalProps {
  assignment: Assignment;
  trigger: React.ReactNode;
  classId: string | null;
}

export default function ScoresModal({
  assignment,
  trigger,
  classId,
}: ScoresModalProps) {
  const { data: classDetail, isLoading } = useQuery<ClassDetail, Error>({
    ...ClassByIdOptions(classId),
  });

  const updateScore = useUpdateStudentScore(classId!, assignment.id);
  const students = useMemo<StudentClassWithStudent[]>(
    () => classDetail?.studentInfo ?? [],
    [classDetail],
  );

  const sections = useMemo(
    () =>
      assignment.sections.length > 0
        ? assignment.sections
        : [
            {
              id: "__total",
              name: "Score",
              points: assignment.total_points ?? 0,
            },
          ],
    [assignment.sections, assignment.total_points],
  );

  const [scores, setScores] = useState<Record<string, number[]>>({});
  const [excused, setExcused] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const initScores: Record<string, number[]> = {};
    const initExc: Record<string, boolean> = {};

    for (const stu of students) {
      const rows = assignment.scores.filter(
        (r) => r.student_id === stu.student_id,
      );
      initExc[stu.student_id] = rows.some((r) => r.excused);
      initScores[stu.student_id] = sections.map((sec) => {
        // if it’s our fake “total” section, match against section_id === null
        const row = rows.find((r) =>
          sec.id === "__total"
            ? r.section_id === null
            : r.section_id === sec.id,
        );
        return row?.score ?? -1;
      });
    }

    setScores(initScores);
    setExcused(initExc);
  }, [assignment.scores, students, sections]);

  const scoreMap = useMemo(() => {
    const m: Record<string, number[]> = {};
    for (const s of students) {
      m[s.student_id] =
        scores[s.student_id] ?? new Array<number>(sections.length).fill(0);
    }
    return m;
  }, [students, scores, sections.length]);

  const [sortKey, setSortKey] = useState<SortKey>("student_number");
  const [asc, setAsc] = useState(true);
  const onSort = (key: SortKey) => {
    if (key === sortKey) setAsc(!asc);
    else {
      setSortKey(key);
      setAsc(true);
    }
  };

  const totalOf = (id: string) =>
    (scoreMap[id] ?? []).reduce((sum, x) => sum + x, 0);
  const pctOf = (id: string) =>
    assignment.total_points ? (totalOf(id) / assignment.total_points) * 100 : 0;

  const sorted = useMemo(() => {
    return [...students].sort((a, b) => {
      let ra: string | number = "",
        rb: string | number = "";
      switch (sortKey) {
        case "student_number":
          ra = a.student_number ?? 0;
          rb = b.student_number ?? 0;
          break;
        case "first_name":
          ra = a.student_name_first_en;
          rb = b.student_name_first_en;
          break;
        case "last_name":
          ra = a.student_name_last_en;
          rb = b.student_name_last_en;
          break;
        case "percentage":
          ra = pctOf(a.student_id);
          rb = pctOf(b.student_id);
          break;
      }
      if (ra < rb) return asc ? -1 : 1;
      if (ra > rb) return asc ? 1 : -1;
      return 0;
    });
  }, [students, sortKey, asc, scoreMap]);

  const onChange = (stuId: string, idx: number, val: number) => {
    setScores((prev) => {
      const base = prev[stuId] ?? scoreMap[stuId] ?? [];
      const arr = [...base];
      arr[idx] = val;
      return { ...prev, [stuId]: arr };
    });
  };
  const onToggleExcused = (stuId: string, checked: boolean) => {
    setExcused((prev) => ({ ...prev, [stuId]: checked }));
  };

  const SortIcon = ({ field }: { field: SortKey }) =>
    sortKey === field ? (
      asc ? (
        <ArrowUp className="ml-1 inline-block" size={14} />
      ) : (
        <ArrowDown className="ml-1 inline-block" size={14} />
      )
    ) : null;

  // number of columns containing NumberInputWithStepper
  const cols = sections.length;

  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="h-full max-h-[calc(100dvh)] w-full min-w-[calc(100dvw)] content-start overflow-auto p-6">
        <DialogHeader>
          <DialogTitle>{assignment.name} Scores</DialogTitle>
          <DialogClose className="absolute top-4 right-4" />
        </DialogHeader>

        <Tabs defaultValue="scores" className="mt-4 flex flex-col">
          <TabsList className="justify-start">
            <TabsTrigger value="scores">Scores</TabsTrigger>
            <TabsTrigger value="reports">Reports</TabsTrigger>
          </TabsList>

          <TabsContent value="scores" className="mt-4">
            <div className="mb-5 text-sm">
              Ctrl + Click the plus (+) and minus (-) buttons to increment by
              0.5. Shift + Click to increment by 1. Ctrl + Shift + Click to
              increment by 5. Ctrl + Shift + Alt + Click to increment by 10 .
              <br />A score of -1 indicates the student has not completed the
              assignment yet.
            </div>
            {isLoading ? (
              <p>Loading students…</p>
            ) : (
              <div className="overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead
                        className="cursor-pointer"
                        onClick={() => onSort("student_number")}
                      >
                        Student #<SortIcon field="student_number" />
                      </TableHead>
                      <TableHead
                        className="cursor-pointer"
                        onClick={() => onSort("first_name")}
                      >
                        First Name
                        <SortIcon field="first_name" />
                      </TableHead>
                      <TableHead
                        className="cursor-pointer"
                        onClick={() => onSort("last_name")}
                      >
                        Last Name
                        <SortIcon field="last_name" />
                      </TableHead>

                      {sections.map((sec) => (
                        <TableHead key={sec.id}>{sec.name}</TableHead>
                      ))}

                      <TableHead>Total</TableHead>
                      <TableHead
                        className="cursor-pointer"
                        onClick={() => onSort("percentage")}
                      >
                        %<SortIcon field="percentage" />
                      </TableHead>
                      <TableHead>Excused</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {sorted.map((stu, rowIdx) => {
                      const isExcused = excused[stu.student_id] ?? false;
                      return (
                        <TableRow
                          key={stu.student_id}
                          className={isExcused ? "opacity-30" : ""}
                        >
                          <TableCell>{stu.student_number ?? ""}</TableCell>
                          <TableCell
                            className={isExcused ? "line-through" : ""}
                          >
                            {stu.student_name_first_en}
                          </TableCell>
                          <TableCell
                            className={isExcused ? "line-through" : ""}
                          >
                            {stu.student_name_last_en}
                          </TableCell>

                          {sections.map((sec, colIdx) => {
                            const tabIndex = rowIdx * cols + colIdx + 1;
                            return (
                              <TableCell key={sec.id} className="py-1">
                                <NumberInputWithStepper
                                  value={
                                    scoreMap[stu.student_id]?.[colIdx] ?? -1
                                  }
                                  min={-1}
                                  max={sec.points}
                                  step={0.1}
                                  disabled={isExcused}
                                  tabIndex={isExcused ? -1 : tabIndex}
                                  onChange={(val) => {
                                    onChange(stu.student_id, colIdx, val);
                                    updateScore.mutate({
                                      student_id: stu.student_id,
                                      class_id: classId!,
                                      graded_assignment_id: assignment.id,
                                      section_id: sec.id,
                                      score: val,
                                      excused: isExcused,
                                    });
                                  }}
                                />
                              </TableCell>
                            );
                          })}

                          <TableCell className="font-semibold">
                            {totalOf(stu.student_id)}
                          </TableCell>
                          <TableCell>
                            {Math.floor(pctOf(stu.student_id))}%
                          </TableCell>
                          <TableCell className="text-center">
                            <Checkbox
                              checked={isExcused}
                              onCheckedChange={(checked) => {
                                const ch = checked === true;
                                onToggleExcused(stu.student_id, ch);
                                updateScore.mutate({
                                  student_id: stu.student_id,
                                  class_id: classId!,
                                  graded_assignment_id: assignment.id,
                                  section_id: null,
                                  score: totalOf(stu.student_id),
                                  excused: ch,
                                });
                              }}
                              aria-label={`Excuse ${stu.student_name_first_en} ${stu.student_name_last_en}`}
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="reports" className="mt-4">
            <p>Reports go here…</p>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
