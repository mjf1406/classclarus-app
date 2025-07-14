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
  type TeacherClassDetail,
  TeacherClassesOptions,
} from "@/app/api/queryOptions";
import type { Assignment } from "../graded-assignments/GradedAssignmentsList";

// JSON‐module support
import commentsData from "@/app/class/components/gradebook/subject-acheivement-comments/s1-comments.json";
import { useQueryState } from "nuqs";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { useAuth } from "@clerk/nextjs";

interface ExportGradesDialogProps {
  classId: string;
  report: Report;
  trigger: React.ReactNode;
}

type GradeCell = {
  label: string;
  reason?: string;
  rawPct: number;
};

export default function ExportGradesDialog({
  classId,
  report,
  trigger,
}: ExportGradesDialogProps) {
  // Helper to strip any "XXX - " prefix and lowercase
  const normalizeSubject = (s: string) =>
    s.split(" - ").pop()!.trim().toLowerCase();
  const { userId } = useAuth();
  if (!userId) throw new Error("Not authenticated");

  // 1) students
  const {
    data: classDetail,
    isLoading: studentsLoading,
    isError: studentsError,
  } = useQuery<ClassDetail, Error>({ ...ClassByIdOptions(classId) });
  const {
    data: teacherClasses,
    isLoading: teacherClassesLoading,
    isError: teacherClassesIsError,
    error: teacherClassesError,
  } = useQuery<TeacherClassDetail[]>(TeacherClassesOptions);
  const [currentClassId, setCurrentClassId] = useQueryState("class_id");
  const activeClass = teacherClasses?.find(
    (i) => i.classInfo.class_id === currentClassId,
  );
  const students = useMemo(
    () => classDetail?.studentInfo ?? [],
    [classDetail?.studentInfo],
  );

  // 2) graded subjects
  const {
    data: allSubjects,
    isLoading: subjectsLoading,
    isError: subjectsError,
  } = useQuery(GradedSubjectsOptions(classId));

  // 3) grade scales
  const {
    data: gradeScales,
    isLoading: scalesLoading,
    isError: scalesError,
  } = useQuery(GradeScaleOptions(userId));

  // 4) assignments
  const {
    data: assignments,
    isLoading: assignmentsLoading,
    isError: assignmentsError,
  } = useQuery<Assignment[]>(GradedAssignmentOptions(classId));

  // per‐subject selected scale
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

  const onScaleChange = (sid: string, scaleId: string) =>
    setSelectedScales((prev) => ({ ...prev, [sid]: scaleId }));

  // flatten all scores
  const allScores = useMemo<AssignmentScore[]>(() => {
    if (!assignments) return [];
    return assignments.flatMap((a) => a.scores ?? []);
  }, [assignments]);

  // build comment map: normalized subject → level → bullet-list
  const commentMap = useMemo(() => {
    const m: Record<string, Record<number, string>> = {};
    (
      commentsData as Array<{
        Subject: string;
        Level: number;
        Details: string[];
      }>
    ).forEach((c) => {
      const key = normalizeSubject(c.Subject);
      const text = c.Details.map((d) => `- ${d}`).join("\n");
      // map both singular and plural to same text
      m[key] = m[key] ?? {};
      m[key][c.Level] = text;
      // also map alternate (math ↔ maths)
      const alt = key.endsWith("s") ? key.slice(0, -1) : key + "s";
      m[alt] = m[alt] ?? {};
      m[alt][c.Level] = text;
    });
    return m;
  }, []);

  // compute gradeInfo, gradeCounts, subjectIssues
  const { gradeInfo, gradeCounts, subjectIssues } = useMemo(() => {
    if (!allSubjects || !gradeScales || !assignments) {
      return {
        gradeInfo: {} as Record<string, Record<string, GradeCell>>,
        gradeCounts: {} as Record<string, Record<string, number>>,
        subjectIssues: {} as Record<
          string,
          { itemName: string; studentNames: string[] }[]
        >,
      };
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

    const gradeInfo: Record<string, Record<string, GradeCell>> = {};
    const gradeCounts: Record<string, Record<string, number>> = {};
    const subjectIssues: Record<
      string,
      { itemName: string; studentNames: string[] }[]
    > = {};

    report.graded_subjects.forEach((sid) => {
      const subj = allSubjects.find((s) => s.id === sid)!;
      gradeInfo[sid] = {};
      gradeCounts[sid] = {};
      subjectIssues[sid] = [];

      // relevant sections
      const relevantSecs = subj.section_ids
        .map((id) => sectionMap[id])
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

      students.forEach((stu) => {
        const stuScores = allScores.filter(
          (sc) => sc.student_id === stu.student_id,
        );

        // sections
        let earnedSecs = 0,
          possibleSecs = totalSecPts;
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

        // assignments without sections
        let earnedAsg = 0,
          possibleAsg = totalAsgPts;
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

        // totals
        const earnedTotal = earnedSecs + earnedAsg;
        const possibleTotal = possibleSecs + possibleAsg;

        // raw & floored percent
        const rawPct =
          possibleTotal > 0 ? (earnedTotal / possibleTotal) * 100 : 0;
        const pct = Math.floor(rawPct);

        // determine grade cell
        let cell: GradeCell;
        if (possibleTotal === 0) {
          cell = { label: "N/A", reason: "No graded items.", rawPct };
        } else {
          const scale = gradeScales.find((gs) => gs.id === selectedScales[sid]);
          if (!scale) {
            cell = { label: "N/A", reason: "No scale selected.", rawPct };
          } else {
            const bucket = scale.grades.find(
              (g) => pct >= g.minPercentage && pct <= g.maxPercentage,
            );
            if (!bucket) {
              cell = {
                label: "N/A",
                reason: `Rounded down ${rawPct.toFixed(1)}%→${pct}%, outside "${scale.name}".`,
                rawPct,
              };
            } else {
              cell = { label: bucket.name, rawPct };
            }
          }
        }

        gradeInfo[sid]![stu.student_id] = cell;
        gradeCounts[sid]![cell.label] =
          (gradeCounts[sid]![cell.label] ?? 0) + 1;

        // record missing
        missingSecs.forEach((itemName) => {
          const e = subjectIssues[sid]!.find((x) => x.itemName === itemName);
          const nm = `${stu.student_name_first_en} ${stu.student_name_last_en}`;
          if (e) {
            e.studentNames.push(nm);
          } else {
            subjectIssues[sid]!.push({ itemName, studentNames: [nm] });
          }
        });
        missingAssignments.forEach((itemName) => {
          const e = subjectIssues[sid]!.find((x) => x.itemName === itemName);
          const nm = `${stu.student_name_first_en} ${stu.student_name_last_en}`;
          if (e) {
            e.studentNames.push(nm);
          } else {
            subjectIssues[sid]!.push({ itemName, studentNames: [nm] });
          }
        });
      });
    });

    return { gradeInfo, gradeCounts, subjectIssues };
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

  // CSV-quote any value
  // CSV-quote any value (only strings or numbers)
  const quote = (val: string | number): string => {
    const s = String(val);
    return `"${s.replace(/"/g, '""')}"`;
  };

  const downloadCsvs = () => {
    if (!allSubjects) return;
    const subjectsList = report.graded_subjects.map((sid) => {
      const subj = allSubjects.find((s) => s.id === sid)!;
      return { id: sid, name: subj.name };
    });

    // grades.csv
    const header1: string[] = ["number", "first name", "last name"];
    subjectsList.forEach((s, i) => {
      header1.push(s.name);
      if (i < subjectsList.length - 1) header1.push("");
    });
    const rows1 = students.map((stu) => {
      const base: Array<string | number> = [
        stu.student_number ?? "",
        stu.student_name_first_en,
        stu.student_name_last_en,
      ];
      subjectsList.forEach((s, i) => {
        base.push(gradeInfo[s.id]![stu.student_id]!.label);
        if (i < subjectsList.length - 1) base.push("");
      });
      return base;
    });
    const csv1 = [header1, ...rows1]
      .map((r) => r.map((c) => quote(c)).join(","))
      .join("\n");
    const blob1 = new Blob([csv1], { type: "text/csv" });
    const url1 = URL.createObjectURL(blob1);
    const a1 = document.createElement("a");
    a1.href = url1;
    a1.download = `${activeClass?.classInfo.class_name} - ${report.name} report - grades.csv`;
    a1.click();
    URL.revokeObjectURL(url1);

    // grades_with_comments.csv
    const header2: string[] = ["number", "first name", "last name"];
    subjectsList.forEach((s) => {
      header2.push(s.name, `${s.name} comment`);
    });
    const rows2 = students.map((stu) => {
      const base: Array<string | number> = [
        stu.student_number ?? "",
        stu.student_name_first_en,
        stu.student_name_last_en,
      ];
      subjectsList.forEach((s) => {
        const cell = gradeInfo[s.id]![stu.student_id];
        const lvl = parseInt(cell!.label, 10) || 0;
        const subjKey = normalizeSubject(s.name);
        const comment = commentMap[subjKey]?.[lvl] ?? "";
        if (cell) base.push(cell.label, comment);
      });
      return base;
    });
    const csv2 = [header2, ...rows2]
      .map((r) => r.map((c) => quote(c)).join(","))
      .join("\n");
    const blob2 = new Blob([csv2], { type: "text/csv" });
    const url2 = URL.createObjectURL(blob2);
    const a2 = document.createElement("a");
    a2.href = url2;
    a2.download = `${activeClass?.classInfo.class_name} - ${report.name} report - grades with comments.csv`;
    a2.click();
    URL.revokeObjectURL(url2);

    // --- plain-text version of grades with comments ---
    const lines: string[] = [];
    students.forEach((stu) => {
      // student header
      lines.push(
        `${stu.student_number ?? ""}\t${stu.student_name_first_en}\t${stu.student_name_last_en}`,
      );
      lines.push("");
      subjectsList.forEach((s) => {
        const cell = gradeInfo[s.id]![stu.student_id];
        const lvl = parseInt(cell!.label, 10) || 0;
        const subjKey = normalizeSubject(s.name);
        const comment = commentMap[subjKey]?.[lvl] ?? "";
        // subject & grade line
        lines.push(`${s.name}: ${cell?.label}\t`);
        // bullet-list comments
        comment.split("\n").forEach((line) => lines.push(line));
        lines.push("");
      });
      // blank line between students
      lines.push("");
    });
    const textContent = lines.join("\n");
    const blob3 = new Blob([textContent], { type: "text/plain" });
    const url3 = URL.createObjectURL(blob3);
    const a3 = document.createElement("a");
    a3.href = url3;
    a3.download = `${activeClass?.classInfo.class_name} - ${report.name} - grades with comments.txt`;
    a3.click();
    URL.revokeObjectURL(url3);
  };

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
            <Button onClick={downloadCsvs} variant={"default"}>
              <Download /> Download CSVs
            </Button>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student #</TableHead>
                  <TableHead>First Name</TableHead>
                  <TableHead>Last Name</TableHead>
                  {report.graded_subjects.map((sid) => {
                    const subj = allSubjects!.find((s) => s.id === sid)!;
                    const counts = gradeCounts[sid] ?? {};
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
                          <table className="mt-1 text-xs">
                            <tbody>
                              {Object.entries(counts).map(([lbl, cnt]) => (
                                <tr key={lbl}>
                                  <td className="pr-2">{lbl}</td>
                                  <td>{cnt}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
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
                    {report.graded_subjects.map((sid) => {
                      const cell = gradeInfo[sid]![stu.student_id];
                      return (
                        <TableCell key={sid}>
                          <span
                            title={cell?.reason}
                            className={
                              cell?.label === "N/A"
                                ? "cursor-help underline"
                                : ""
                            }
                          >
                            {cell?.label} ({cell?.rawPct.toFixed(2)}%)
                          </span>
                        </TableCell>
                      );
                    })}
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
