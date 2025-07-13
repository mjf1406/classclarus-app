"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import jsPDF from "jspdf";
// cSpell:ignore autotable
import autoTable from "jspdf-autotable";
import {
  ClassByIdOptions,
  GradedAssignmentOptions,
} from "@/app/api/queryOptions";

// Extend jsPDF type for autoTable
declare module "jspdf" {
  interface jsPDF {
    lastAutoTable: {
      finalY: number;
    };
  }
}

interface AssignmentReportButtonProps {
  report: {
    id: string;
    name: string;
    graded_subjects: string[];
  };
  classId: string;
  className: string;
}

interface GradedSubject {
  id: string;
  graded_assignment_ids: string[];
}

// Type for table row data
type TableRowData = (string | number)[];

// Query options for graded subjects
const GradedSubjectsOptions = (classId: string | null) => ({
  queryKey: ["graded_subjects", classId],
  queryFn: async () => {
    const response = await fetch(
      `/api/graded-subjects-by-class-id?class_id=${classId}`,
    );
    if (!response.ok) {
      throw new Error("Failed to load graded subjects data.");
    }
    return (await response.json()) as GradedSubject[];
  },
  staleTime: 1000 * 60 * 30,
});

export function AssignmentReportButton({
  report,
  classId,
  className,
}: AssignmentReportButtonProps) {
  const [isGenerating, setIsGenerating] = useState(false);

  const { data: gradedAssignments } = useQuery(
    GradedAssignmentOptions(classId),
  );
  const { data: classDetail } = useQuery(ClassByIdOptions(classId));
  const { data: gradedSubjects } = useQuery(GradedSubjectsOptions(classId));

  const calculateStats = (scores: number[]) => {
    if (scores.length === 0) {
      return { mean: 0, median: 0, stdDev: 0, max: 0 };
    }

    const validScores = scores.filter((score) => score >= 0);
    if (validScores.length === 0) {
      return { mean: 0, median: 0, stdDev: 0, max: 0 };
    }

    const mean = validScores.reduce((a, b) => a + b, 0) / validScores.length;
    const sortedScores = [...validScores].sort((a, b) => a - b);
    const median =
      sortedScores.length % 2 === 0
        ? (sortedScores[sortedScores.length / 2 - 1]! +
            sortedScores[sortedScores.length / 2]!) /
          2
        : sortedScores[Math.floor(sortedScores.length / 2)]!;

    const variance =
      validScores.reduce((acc, score) => acc + Math.pow(score - mean, 2), 0) /
      validScores.length;
    const stdDev = Math.sqrt(variance);
    const max = Math.max(...validScores);

    return { mean, median, stdDev, max };
  };

  const generatePDF = async () => {
    if (
      !gradedAssignments ||
      !classDetail ||
      !gradedSubjects ||
      !report.graded_subjects.length
    ) {
      return;
    }

    setIsGenerating(true);

    try {
      // Get assignment IDs from the report's graded subjects
      const assignmentIds = new Set<string>();
      report.graded_subjects.forEach((subjectId) => {
        const subject = gradedSubjects.find((s) => s.id === subjectId);
        if (subject) {
          subject.graded_assignment_ids.forEach((id) => assignmentIds.add(id));
        }
      });

      // Filter assignments to only those in the report
      const reportAssignments = gradedAssignments.filter((assignment) =>
        assignmentIds.has(assignment.id),
      );

      if (reportAssignments.length === 0) {
        alert("No assignments found for this report.");
        return;
      }

      const students = classDetail.studentInfo;
      const doc = new jsPDF("portrait", "mm", "a4");
      let isFirstPage = true;

      students.forEach((student) => {
        if (!isFirstPage) {
          doc.addPage();
        }
        isFirstPage = false;

        // Header with student info
        doc.setFontSize(16);
        doc.setFont("helvetica", "bold");
        doc.text(
          `Student #${student.student_number}: ${student.student_name_first_en} ${student.student_name_last_en}`,
          20,
          20,
        );

        let yPosition = 40;

        reportAssignments.forEach((assignment) => {
          // Calculate assignment stats across all students
          const allStudentTotalScores: number[] = [];

          students.forEach((s) => {
            let studentTotal = 0;
            let isExcused = false;

            // Check if student is excused from the entire assignment
            const assignmentScore = assignment.scores.find(
              (score) => score.student_id === s.student_id && !score.section_id,
            );
            if (assignmentScore?.excused || (assignmentScore?.score ?? 0) < 0) {
              isExcused = true;
            }

            if (!isExcused) {
              if (assignment.sections.length > 0) {
                // Sum section scores
                assignment.sections.forEach((section) => {
                  const sectionScore = section.scores.find(
                    (score) => score.student_id === s.student_id,
                  );
                  if (
                    sectionScore &&
                    !sectionScore.excused &&
                    sectionScore.score >= 0
                  ) {
                    studentTotal += sectionScore.score;
                  }
                });
              } else {
                // Use total assignment score
                if (assignmentScore && assignmentScore.score >= 0) {
                  studentTotal = assignmentScore.score;
                }
              }
              allStudentTotalScores.push(studentTotal);
            }
          });

          const stats = calculateStats(allStudentTotalScores);

          // Prepare table data for this assignment
          const tableHeaders = ["Assignment"];
          const tableData: TableRowData[] = [];

          if (assignment.sections.length > 0) {
            // Add section headers
            assignment.sections.forEach((section) => {
              tableHeaders.push(`${section.name}\n(${section.points} pts)`);
            });
          }

          tableHeaders.push(
            "Total",
            "Percentage",
            "Mean",
            "Median",
            "Std Dev",
            "Max",
          );

          // Get student's data for this assignment
          let studentTotal = 0;
          let maxPossible = 0;
          let isStudentExcused = false;
          const rowData: TableRowData = [assignment.name];

          // Check if student is excused from entire assignment
          const studentAssignmentScore = assignment.scores.find(
            (score) =>
              score.student_id === student.student_id && !score.section_id,
          );
          if (
            studentAssignmentScore?.excused ||
            (studentAssignmentScore?.score ?? 0) < 0
          ) {
            isStudentExcused = true;
          }

          if (isStudentExcused) {
            if (assignment.sections.length > 0) {
              assignment.sections.forEach(() => {
                rowData.push("Excused");
              });
            }
            rowData.push(
              "Excused",
              "Excused",
              stats.mean.toFixed(1),
              stats.median.toFixed(1),
              stats.stdDev.toFixed(1),
              stats.max.toString(),
            );
          } else {
            if (assignment.sections.length > 0) {
              // Add section scores
              assignment.sections.forEach((section) => {
                const sectionScore = section.scores.find(
                  (score) => score.student_id === student.student_id,
                );
                if (
                  sectionScore &&
                  !sectionScore.excused &&
                  sectionScore.score >= 0
                ) {
                  rowData.push(`${sectionScore.score}/${section.points}`);
                  studentTotal += sectionScore.score;
                  maxPossible += section.points;
                } else {
                  rowData.push("0/" + section.points);
                  maxPossible += section.points;
                }
              });
            } else {
              // Use total assignment score
              if (studentAssignmentScore && studentAssignmentScore.score >= 0) {
                studentTotal = studentAssignmentScore.score;
              }
              maxPossible = assignment.total_points ?? 0;
            }

            const percentage =
              maxPossible > 0 ? (studentTotal / maxPossible) * 100 : 0;

            rowData.push(
              `${studentTotal}/${maxPossible}`,
              `${percentage.toFixed(1)}%`,
              stats.mean.toFixed(1),
              stats.median.toFixed(1),
              stats.stdDev.toFixed(1),
              stats.max.toString(),
            );
          }

          tableData.push(rowData);

          // Generate table using autoTable function
          autoTable(doc, {
            head: [tableHeaders],
            body: tableData,
            startY: yPosition,
            styles: {
              fontSize: 8,
              cellPadding: 2,
            },
            headStyles: {
              fillColor: [66, 139, 202],
              textColor: 255,
              fontStyle: "bold",
            },
            columnStyles: {
              0: { cellWidth: 30 }, // Assignment name
            },
            margin: { left: 20, right: 20 },
            pageBreak: "avoid",
          });

          // Get the final Y position after the table
          yPosition = doc.lastAutoTable.finalY + 15;

          // Check if we need a new page
          if (yPosition > 250) {
            doc.addPage();
            yPosition = 20;
          }
        });
      });

      // Save the PDF
      const filename = `${className} - ${report.name} - Assignment Reports.pdf`;
      doc.save(filename);
    } catch (error) {
      console.error("Error generating PDF:", error);
      alert("Failed to generate PDF. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Button
      onClick={generatePDF}
      disabled={isGenerating || !gradedAssignments || !classDetail}
      size="sm"
      variant="secondary"
    >
      {isGenerating ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Download className="h-4 w-4" />
      )}
      {isGenerating ? "Generating..." : "Assignment Reports"}
    </Button>
  );
}
