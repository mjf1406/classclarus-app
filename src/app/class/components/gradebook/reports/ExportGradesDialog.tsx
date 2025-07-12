// components/ExportGradesDialog.tsx
"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

import type { Report, ClassDetail, AssignmentScore } from "@/server/db/types";
import {
  GradedSubjectsOptions,
  GradeScaleOptions,
  ClassByIdOptions,
  GradedAssignmentOptions,
} from "@/app/api/queryOptions";
import type { Assignment } from "../graded-assignments/GradedAssignmentsList";

interface ExportGradesDialogProps {
  classId: string;
  report: Report;
  trigger: React.ReactNode;
}

export default function ExportGradesDialog({
  classId,
  report,
  trigger,
}: ExportGradesDialogProps) {
  // 1) students
  const {
    data: classDetail,
    isLoading: studentsLoading,
    isError: studentsError,
  } = useQuery<ClassDetail, Error>({ ...ClassByIdOptions(classId) });
  const students = useMemo(
    () => classDetail?.studentInfo ?? [],
    [classDetail?.studentInfo],
  );

  // 2) subjects
  const {
    data: allSubjects,
    isLoading: subjectsLoading,
    isError: subjectsError,
  } = useQuery(GradedSubjectsOptions(classId));

  // 3) scales
  const {
    data: gradeScales,
    isLoading: scalesLoading,
    isError: scalesError,
  } = useQuery(GradeScaleOptions());

  // 4) assignments
  const {
    data: assignments,
    isLoading: assignmentsLoading,
    isError: assignmentsError,
  } = useQuery<Assignment[]>(GradedAssignmentOptions(classId));

  // per-subject selected scale
  const [selectedScales, setSelectedScales] = useState<Record<string, string>>(
    {},
  );
  useEffect(() => {
    if (!allSubjects || !gradeScales) return;
    const init: Record<string, string> = {};
    report.graded_subjects.forEach((sid) => {
      const subj = allSubjects.find((s) => s.id === sid);
      init[sid] = subj?.default_grade_scale ?? gradeScales[0]?.id ?? "";
    });
    setSelectedScales(init);
  }, [allSubjects, gradeScales, report.graded_subjects]);

  const onScaleChange = (subjectId: string, scaleId: string) =>
    setSelectedScales((prev) => ({ ...prev, [subjectId]: scaleId }));

  // flatten all scores
  const allScores = useMemo<AssignmentScore[]>(() => {
    if (!assignments) return [];
    return assignments.flatMap((a) => a.scores ?? []);
  }, [assignments]);

  // compute gradeLabels + missing issues
  const { gradeLabels, subjectIssues } = useMemo(() => {
    if (!allSubjects || !gradeScales || !assignments || students.length === 0) {
      return { gradeLabels: {}, subjectIssues: {} };
    }

    // build lookups
    const sectionMap: Record<
      string,
      { id: string; name: string; points: number; assignmentId: string }
    > = {};
    const assignmentMap: Record<string, Assignment> = {};

    assignments.forEach((a) => {
      assignmentMap[a.id] = a;
      a.sections.forEach((sec) => {
        sectionMap[sec.id] = { ...sec, assignmentId: a.id };
      });
    });

    const gradeLabels: Record<string, Record<string, string>> = {};
    const subjectIssues: Record<
      string,
      { itemName: string; studentNames: string[] }[]
    > = {};

    report.graded_subjects.forEach((sid) => {
      const subj = allSubjects.find((s) => s.id === sid)!;

      // sections for this subject
      const relevantSecs = subj.section_ids
        .map((secId) => sectionMap[secId])
        .filter(
          (
            sec,
          ): sec is {
            id: string;
            name: string;
            points: number;
            assignmentId: string;
          } => sec !== undefined,
        );
      const totalSecPts = relevantSecs.reduce(
        (sum, sec) => sum + sec.points,
        0,
      );

      // assignments without sections
      const subjectAssignments = subj.graded_assignment_ids
        .map((aid) => assignmentMap[aid])
        .filter((a): a is Assignment => a !== undefined);
      const assignmentsWithoutSections = subjectAssignments.filter(
        (a) => a.sections.length === 0,
      );
      const totalAsgPts = assignmentsWithoutSections.reduce(
        (sum, a) => sum + (a.total_points ?? 0),
        0,
      );

      gradeLabels[sid] = {};
      subjectIssues[sid] = [];

      students.forEach((stu) => {
        const stuScores = allScores.filter(
          (sc) => sc.student_id === stu.student_id,
        );

        // --- sections pass ---
        let earnedSecs = 0;
        let possibleSecs = totalSecPts;
        const missingSecs: string[] = [];

        relevantSecs.forEach((sec) => {
          const recSec = stuScores.find((sc) => sc.section_id === sec.id);
          const recAsg = stuScores.find(
            (sc) =>
              sc.graded_assignment_id === sec.assignmentId &&
              (sc.section_id === null || sc.section_id === undefined),
          );

          if (recSec) {
            if (recSec.excused) possibleSecs -= sec.points;
            else earnedSecs += recSec.score;
          } else if (recAsg?.excused) {
            possibleSecs -= sec.points;
          } else {
            missingSecs.push(sec.name);
            possibleSecs -= sec.points;
          }
        });

        // --- assignments without sections ---
        let earnedAsg = 0;
        let possibleAsg = totalAsgPts;
        const missingAssignments: string[] = [];

        assignmentsWithoutSections.forEach((a) => {
          const rec = stuScores.find(
            (sc) =>
              sc.graded_assignment_id === a.id &&
              (sc.section_id === null || sc.section_id === undefined),
          );
          if (rec) {
            if (rec.excused) possibleAsg -= a.total_points ?? 0;
            else earnedAsg += rec.score;
          } else {
            missingAssignments.push(a.name);
            possibleAsg -= a.total_points ?? 0;
          }
        });

        const earnedTotal = earnedSecs + earnedAsg;
        const possibleTotal = possibleSecs + possibleAsg;
        const pct = possibleTotal > 0 ? (earnedTotal / possibleTotal) * 100 : 0;

        // find grade label
        const scale = gradeScales.find((gs) => gs.id === selectedScales[sid]);
        let gradeName = "N/A";
        if (scale) {
          const g = scale.grades.find(
            (g) => pct >= g.minPercentage && pct <= g.maxPercentage,
          );
          gradeName = g?.name ?? "N/A";
        }
        gradeLabels[sid]![stu.student_id] = gradeName;

        // record missing sections
        missingSecs.forEach((itemName) => {
          const entry = subjectIssues[sid]?.find(
            (x) => x.itemName === itemName,
          );
          const nm = `${stu.student_name_first_en} ${stu.student_name_last_en}`;
          if (entry) entry.studentNames.push(nm);
          else subjectIssues[sid]?.push({ itemName, studentNames: [nm] });
        });

        // record missing assignments
        missingAssignments.forEach((itemName) => {
          const entry = subjectIssues[sid]?.find(
            (x) => x.itemName === itemName,
          );
          const nm = `${stu.student_name_first_en} ${stu.student_name_last_en}`;
          if (entry) entry.studentNames.push(nm);
          else subjectIssues[sid]?.push({ itemName, studentNames: [nm] });
        });
      });
    });

    return { gradeLabels, subjectIssues };
  }, [
    allSubjects,
    gradeScales,
    assignments,
    allScores,
    students,
    report.graded_subjects,
    selectedScales,
  ]);

  const loadingAll =
    studentsLoading || subjectsLoading || scalesLoading || assignmentsLoading;
  const errorAny =
    studentsError || subjectsError || scalesError || assignmentsError;

  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="h-full max-h-[calc(100dvh)] w-full min-w-[calc(100dvw)] overflow-auto p-6">
        <DialogHeader>
          <DialogTitle>Export Grades — {report.name}</DialogTitle>
          <DialogClose className="absolute top-4 right-4" />
        </DialogHeader>

        {loadingAll ? (
          <p>Loading…</p>
        ) : errorAny ? (
          <p className="text-destructive">Failed to load data.</p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student #</TableHead>
                  <TableHead>First Name</TableHead>
                  <TableHead>Last Name</TableHead>
                  {report.graded_subjects.map((sid) => {
                    const subj = allSubjects!.find((s) => s.id === sid)!;
                    return (
                      <TableHead key={sid}>
                        <div className="flex flex-col items-start space-y-1">
                          <span>{subj.name}</span>
                          <Select
                            value={selectedScales[sid]}
                            onValueChange={(v) => onScaleChange(sid, v)}
                          >
                            <SelectTrigger className="mt-1 w-full">
                              <SelectValue placeholder="Scale" />
                            </SelectTrigger>
                            <SelectContent>
                              {gradeScales!.map((gs) => (
                                <SelectItem key={gs.id} value={gs.id}>
                                  {gs.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </TableHead>
                    );
                  })}
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map((stu) => (
                  <TableRow key={stu.student_id}>
                    <TableCell>{stu.student_number}</TableCell>
                    <TableCell>{stu.student_name_first_en}</TableCell>
                    <TableCell>{stu.student_name_last_en}</TableCell>
                    {report.graded_subjects.map((sid) => (
                      <TableCell key={sid}>
                        {gradeLabels[sid]?.[stu.student_id] ?? "N/A"}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="mt-8">
              <h3 className="text-lg font-semibold">Missing Scores</h3>
              {report.graded_subjects.map((sid) => {
                const subj = allSubjects!.find((s) => s.id === sid)!;
                const issues = subjectIssues[sid];
                if (!issues?.length) return null;
                return (
                  <div key={sid} className="mt-4">
                    <h4 className="font-semibold">{subj.name}</h4>
                    <ul className="ml-4 list-disc">
                      {issues.map((it) => (
                        <li key={it.itemName}>
                          <span className="font-medium">{it.itemName}:</span>
                          <ul className="ml-4 list-disc">
                            {it.studentNames.map((nm) => (
                              <li key={nm}>{nm}</li>
                            ))}
                          </ul>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
