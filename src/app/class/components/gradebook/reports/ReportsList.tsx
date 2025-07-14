// src\app\class\components\gradebook\reports\ReportsList.tsx
"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import {
  ChevronUp,
  Download,
  Edit,
  MessageCirclePlus,
  Percent,
  Trash2,
} from "lucide-react";
import { SiHyperskill } from "react-icons/si";

import type {
  ClassDetail,
  Report,
  StudentClassWithStudent,
} from "@/server/db/types";
import EditReportDialog from "./EditReportDialog";
import { useDeleteReport } from "./hooks/useDeleteReportHook";
import {
  ReportOptions,
  GradedSubjectsOptions,
  GradeScaleOptions,
  type TeacherClassDetail,
  TeacherClassesOptions,
  CenturySkillsOptions,
  ClassByIdOptions,
} from "@/app/api/queryOptions";
import ExportGradesDialog from "./ExportGradesDialog";
import { AssignmentReportButton } from "./AssignmentReportsPdfGenerator";
import { useQueryState } from "nuqs";
import CenturySkillsModal from "./CenturySkillsModal";
import { useMemo } from "react";
import SubjectCommentsDialog from "./SubjectCommentsDialog";
import { useAuth } from "@clerk/nextjs";

interface ReportsListProps {
  classId: string | null;
}

export default function ReportsList({ classId }: ReportsListProps) {
  const { data: reports, isLoading, error } = useQuery(ReportOptions(classId));

  if (isLoading) {
    return (
      <div className="text-muted-foreground py-16 text-center text-sm">
        Loading reports…
      </div>
    );
  }
  if (error) {
    return (
      <div className="text-destructive py-16 text-center text-sm">
        Failed to load reports.
      </div>
    );
  }
  if (!reports || reports.length === 0) {
    return (
      <div className="text-muted-foreground py-16 text-center text-sm">
        No reports found.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {reports.map((report) => (
        <ReportCard key={report.id} report={report} classId={classId!} />
      ))}
    </div>
  );
}

function ReportCard({ report, classId }: { report: Report; classId: string }) {
  const [sectionsOpen, setSectionsOpen] = React.useState(false);
  const [alertOpen, setAlertOpen] = React.useState(false);
  const [exportOpen, setExportOpen] = React.useState(false);
  const { userId } = useAuth();
  if (!userId) throw new Error("Not authenticated");

  const deleteReport = useDeleteReport(classId);
  const isDeleting = deleteReport.isPending;

  const {
    data: centurySkills,
    isLoading: centurySkillsLoading,
    isError: centurySkillsError,
  } = useQuery(CenturySkillsOptions(classId));

  const {
    data: allSubjects,
    isLoading: subjectsLoading,
    isError: subjectsError,
  } = useQuery(GradedSubjectsOptions(classId));

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

  const {
    data: gradeScales,
    isLoading: scalesLoading,
    isError: scalesError,
  } = useQuery(GradeScaleOptions(userId));

  const [selectedScales, setSelectedScales] = React.useState<
    Record<string, string>
  >({});

  const { data: classDetail, isLoading } = useQuery<ClassDetail, Error>({
    ...ClassByIdOptions(classId),
  });

  const students = useMemo<StudentClassWithStudent[]>(
    () => classDetail?.studentInfo ?? [],
    [classDetail],
  );

  React.useEffect(() => {
    if (allSubjects && gradeScales) {
      const init: Record<string, string> = {};
      report.graded_subjects.forEach((sid) => {
        init[sid] = gradeScales[0]?.id ?? "";
      });
      setSelectedScales(init);
    }
  }, [allSubjects, gradeScales, report.graded_subjects]);

  const onScaleChange = (subjectId: string, scaleId: string) => {
    setSelectedScales((prev) => ({ ...prev, [subjectId]: scaleId }));
  };

  function getGradeLabel(student: StudentClassWithStudent, subjectId: string) {
    // Placeholder for computed grade label
    return "N/A";
  }

  const onConfirmDelete = () => {
    setAlertOpen(false);
    deleteReport.mutate(report.id);
  };

  return (
    <Card className="border">
      <CardContent className="space-y-4">
        <CardHeader className="flex items-start justify-between p-0">
          <CardTitle>{report.name}</CardTitle>
          <div className="flex items-center space-x-2">
            {/* Export Dialog */}
            <ExportGradesDialog
              classId={classId}
              report={report}
              trigger={
                <Button variant="secondary" size="sm">
                  <Percent />
                  <span className="hidden sm:block">Grades</span>
                </Button>
              }
            />

            <AssignmentReportButton
              report={report}
              classId={classId}
              className={activeClass?.classInfo.class_name ?? "Unknown Class"}
              trigger={
                <Button variant="secondary" size="sm">
                  <Download />
                  <span className="hidden lg:block">Assignment Reports</span>
                </Button>
              }
            />

            <CenturySkillsModal
              reportId={report.id}
              classId={classId}
              centurySkills={centurySkills ?? []}
              students={students}
              trigger={
                <Button variant={"secondary"} className="bg-secondary/70">
                  <SiHyperskill />{" "}
                  <span className="hidden lg:block">21st Century Skills</span>
                </Button>
              }
            />

            <SubjectCommentsDialog
              report={report}
              trigger={
                <Button variant={"secondary"} className="bg-secondary/70">
                  <MessageCirclePlus />{" "}
                  <span className="hidden lg:block">Subject Comments</span>
                </Button>
              }
            />

            <EditReportDialog
              classId={classId}
              report={report}
              trigger={
                <Button variant="outline" size="sm">
                  <Edit /> <span className="hidden lg:block">Edit</span>
                </Button>
              }
            />

            <AlertDialog open={alertOpen} onOpenChange={setAlertOpen}>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 /> <span className="hidden xl:block">Delete</span>
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Report?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete report{" "}
                    <span className="font-bold">{report.name}</span>.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="flex justify-end space-x-2">
                  <AlertDialogCancel asChild>
                    <Button variant="outline">Cancel</Button>
                  </AlertDialogCancel>
                  <AlertDialogAction asChild>
                    <Button
                      variant="destructive"
                      disabled={isDeleting}
                      onClick={onConfirmDelete}
                    >
                      {isDeleting ? "Deleting…" : "Delete"}
                    </Button>
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardHeader>

        <Separator />

        <Collapsible open={sectionsOpen} onOpenChange={setSectionsOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm">
              <span>
                Graded Subject
                {report.graded_subjects.length !== 1 ? "s" : ""}:
              </span>
              <span className="font-semibold">
                {report.graded_subjects.length}
              </span>
              <ChevronUp
                className={`h-4 w-4 transition-transform duration-200 ${
                  sectionsOpen ? "rotate-180" : "rotate-0"
                }`}
              />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            {subjectsLoading ? (
              <div>Loading subjects…</div>
            ) : subjectsError ? (
              <div>Error loading subjects</div>
            ) : report.graded_subjects.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.graded_subjects.map((sid) => {
                    const subj = allSubjects?.find((s) => s.id === sid);
                    return (
                      <TableRow key={sid}>
                        <TableCell>{subj?.name ?? sid}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <div className="text-muted-foreground text-sm">No subjects.</div>
            )}
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}
