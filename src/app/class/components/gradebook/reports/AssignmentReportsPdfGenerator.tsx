"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2, Settings } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
  trigger: React.ReactNode;
}

interface GradedSubject {
  id: string;
  graded_assignment_ids: string[];
  section_ids: string[]; // Added this property
}

// Type for table row data
type TableRowData = (string | number)[];

// Print layout options
type PrintLayout = "normal" | "2-per-sheet" | "4-per-sheet";

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
  trigger,
}: AssignmentReportButtonProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [printLayout, setPrintLayout] = useState<PrintLayout>("normal");

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

  const addBlankPages = (
    doc: jsPDF,
    currentPageCount: number,
    targetMultiple: number,
  ) => {
    const remainder = currentPageCount % targetMultiple;
    if (remainder !== 0) {
      const pagesToAdd = targetMultiple - remainder;
      for (let i = 0; i < pagesToAdd; i++) {
        doc.addPage();
        // Add a subtle "blank page" indicator
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(200, 200, 200);
        doc.text("(Blank page for printing alignment)", 20, 20);
        doc.setTextColor(0, 0, 0); // Reset color
      }
    }
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
      // Get both assignment IDs and section IDs from the report's graded subjects
      // Get both assignment IDs and section IDs from the report's graded subjects
      const assignmentIds = new Set<string>();
      const includedSectionIds = new Set<string>();

      report.graded_subjects.forEach((subjectId) => {
        const subject = gradedSubjects.find((s) => s.id === subjectId);
        if (subject) {
          // Add assignments that are fully included
          subject.graded_assignment_ids.forEach((id: string) =>
            assignmentIds.add(id),
          );
          // Add individual sections that are included
          subject.section_ids.forEach((id: string) =>
            includedSectionIds.add(id),
          );
        }
      });

      // Filter assignments to include:
      // 1. Assignments fully included in subjects
      // 2. Assignments that have at least one section included in the report
      // Keep ALL sections for any included assignment
      const reportAssignments = gradedAssignments.filter((assignment) => {
        // Include if the whole assignment is included
        if (assignmentIds.has(assignment.id)) return true;

        // Include if any of its sections are included
        return assignment.sections.some((section) =>
          includedSectionIds.has(section.id),
        );
      });

      if (reportAssignments.length === 0) {
        alert("No assignments found for this report.");
        return;
      }

      const students = classDetail.studentInfo;
      const doc = new jsPDF("landscape", "mm", "a4");

      // Remove the initial blank page
      doc.deletePage(1);

      students.forEach((student, studentIndex) => {
        const pageCountBeforeStudent = doc.getNumberOfPages();

        // Add first page for this student
        doc.addPage();

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
          if (yPosition > 180) {
            // Reduced from 250 for landscape
            doc.addPage();
            yPosition = 20;
          }
        });

        // Add padding pages if needed (except for the last student)
        if (studentIndex < students.length - 1) {
          const studentPageCount =
            doc.getNumberOfPages() - pageCountBeforeStudent;

          if (printLayout === "2-per-sheet") {
            addBlankPages(doc, studentPageCount, 2);
          } else if (printLayout === "4-per-sheet") {
            addBlankPages(doc, studentPageCount, 4);
          }
        }
      });

      // Save the PDF
      const layoutSuffix = printLayout === "normal" ? "" : ` (${printLayout})`;
      const filename = `${className} - ${report.name} - Assignment Reports${layoutSuffix}.pdf`;
      doc.save(filename);
    } catch (error) {
      console.error("Error generating PDF:", error);
      alert("Failed to generate PDF. Please try again.");
    } finally {
      setIsGenerating(false);
      setDialogOpen(false);
    }
  };

  return (
    <>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogTrigger asChild>{trigger}</DialogTrigger>

        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Print Layout Settings
            </DialogTitle>
            <DialogDescription>
              Choose your print layout to optimize paper usage. The PDF will
              automatically add blank pages to ensure each student&apos;s report
              starts on a new physical sheet.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Label htmlFor="print-layout">Print Layout</Label>
            <RadioGroup
              value={printLayout}
              onValueChange={(value) => setPrintLayout(value as PrintLayout)}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="normal" id="normal" />
                <Label htmlFor="normal" className="flex-1">
                  <div className="font-medium">Normal (1 page per sheet)</div>
                  <div className="text-muted-foreground text-sm">
                    Standard printing, no optimization
                  </div>
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <RadioGroupItem value="2-per-sheet" id="2-per-sheet" />
                <Label htmlFor="2-per-sheet" className="flex-1">
                  <div className="font-medium">2 pages per sheet</div>
                  <div className="text-muted-foreground text-sm">
                    Each student uses an even number of pages
                  </div>
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <RadioGroupItem value="4-per-sheet" id="4-per-sheet" />
                <Label htmlFor="4-per-sheet" className="flex-1">
                  <div className="font-medium">4 pages per sheet</div>
                  <div className="text-muted-foreground text-sm">
                    Each student uses a multiple of 4 pages
                  </div>
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={generatePDF}>Download PDF</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
