"use client";

import React, { useState } from "react";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import type { StudentClassWithStudent, RazRecord } from "@/server/db/types";
import CreateRecordDialog from "./CreateRecordDialog";

type ScheduleInfo = {
  category: string;
  lowerBoundDays: number;
  upperBoundDays: number;
  scheduleText: string;
};

function getScheduleInfo(level?: string): ScheduleInfo {
  if (!level) {
    return {
      category: "No Previous Record",
      lowerBoundDays: 0,
      upperBoundDays: 0,
      scheduleText:
        "No test record found. An initial assessment is recommended immediately.",
    };
  }

  const firstLetter = level.charAt(0).toUpperCase();
  if (["A", "B", "C"].includes(firstLetter)) {
    return {
      category: "Beginning Readers",
      lowerBoundDays: 14, // 2 weeks
      upperBoundDays: 28, // 4 weeks
      scheduleText: "Tests should be administered every 2 to 4 weeks.",
    };
  } else if (["D", "E", "F", "G", "H", "I", "J"].includes(firstLetter)) {
    return {
      category: "Developing Readers",
      lowerBoundDays: 28, // 4 weeks
      upperBoundDays: 42, // 6 weeks
      scheduleText: "Tests should be administered every 4 to 6 weeks.",
    };
  } else if (["K", "L", "M", "N", "O", "P"].includes(firstLetter)) {
    return {
      category: "Effective Readers",
      lowerBoundDays: 42, // 6 weeks
      upperBoundDays: 56, // 8 weeks
      scheduleText: "Tests should be administered every 6 to 8 weeks.",
    };
  } else if (
    ["Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z"].includes(firstLetter)
  ) {
    return {
      category: "Automatic Readers",
      lowerBoundDays: 56, // 8 weeks
      upperBoundDays: 70, // 10 weeks
      scheduleText: "Tests should be administered every 8 to 10 weeks.",
    };
  }
  return {
    category: "Unknown",
    lowerBoundDays: 0,
    upperBoundDays: 0,
    scheduleText: "Schedule information is not available.",
  };
}

function calculateDaysSince(dateStr: string): number {
  const testDate = new Date(dateStr);
  const currentDate = new Date();
  const msInDay = 1000 * 60 * 60 * 24;
  return Math.floor((currentDate.getTime() - testDate.getTime()) / msInDay);
}

interface TestTimeProps {
  studentInfo: StudentClassWithStudent[];
  raz: RazRecord[];
  defaultClassId?: string;
}

const TestTime: React.FC<TestTimeProps> = ({
  studentInfo,
  raz,
  defaultClassId,
}) => {
  const [selectedStudent, setSelectedStudent] =
    useState<StudentClassWithStudent | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Build a map of the most recent record for each student.
  const latestRecordsByStudent = new Map<string, RazRecord>();
  raz.forEach((record) => {
    const studentId = record.student_id;
    const existing = latestRecordsByStudent.get(studentId);
    if (!existing || new Date(record.date) > new Date(existing.date)) {
      latestRecordsByStudent.set(studentId, record);
    }
  });

  // Build the list of due students.
  const dueStudents = studentInfo.map((student) => {
    const record = latestRecordsByStudent.get(student.student_id);
    const daysSince = record ? calculateDaysSince(record.date) : null;
    const scheduleInfo = record
      ? getScheduleInfo(record.level)
      : getScheduleInfo(undefined);

    // If no record exists, we flag as overdue with a high value.
    const overdueValue =
      daysSince === null ? 9999 : daysSince - scheduleInfo.lowerBoundDays;

    // Assessment is required if no record exists, if the previous result was "level down",
    // or if the days since the last test is at least the scheduled lower bound.
    const assessmentRequired = record
      ? record.result === "level down" ||
        daysSince! >= scheduleInfo.lowerBoundDays
      : true;

    let message = "";
    if (record) {
      const reasons: string[] = [];
      if (record.result === "level down") {
        reasons.push("the previous assessment resulted in a level down");
      }
      if (daysSince !== null && daysSince >= scheduleInfo.lowerBoundDays) {
        reasons.push(
          `more than ${scheduleInfo.lowerBoundDays} days have passed`,
        );
      }
      // Build a succinct message without schedule recommendation detail.
      const assessmentText = assessmentRequired
        ? `Assessment required because ${reasons.join(" and ")}.`
        : "No assessment is required.";
      message = `${assessmentText} Last test was ${daysSince} day(s) ago.`;
    } else {
      message = "Initial assessment recommended.";
    }

    return {
      student,
      record,
      daysSince,
      scheduleInfo,
      overdueValue,
      message,
      assessmentRequired,
    };
  });

  // Sort dueStudents: students with a previous "level down" appear first, then by overdueValue descending.
  dueStudents.sort((a, b) => {
    if (
      a.record?.result === "level down" &&
      b.record?.result !== "level down"
    ) {
      return -1;
    } else if (
      b.record?.result === "level down" &&
      a.record?.result !== "level down"
    ) {
      return 1;
    }
    return b.overdueValue - a.overdueValue;
  });

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-xl font-bold">Students Due for a Test</h2>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Number</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Reading Level</TableHead>
              <TableHead>Last Test Date</TableHead>
              <TableHead>Days Since Test</TableHead>
              <TableHead>Test Schedule</TableHead>
              <TableHead>Assessment Required</TableHead>
              <TableHead>Why Must I Assess?</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {dueStudents.map(
              ({
                student,
                record,
                daysSince,
                message,
                assessmentRequired,
                scheduleInfo,
              }) => (
                <TableRow
                  key={student.student_id}
                  className="cursor-pointer hover:bg-gray-100"
                  onClick={() => {
                    const updatedStudent = {
                      ...student,
                      student_reading_level: record
                        ? record.level
                        : student?.student_reading_level?.toUpperCase(),
                    };
                    setSelectedStudent(updatedStudent);
                    setDialogOpen(true);
                  }}
                >
                  <TableCell>{student.student_number ?? "N/A"}</TableCell>
                  <TableCell>
                    {student.student_name_first_en}{" "}
                    {student.student_name_last_en}
                  </TableCell>
                  <TableCell>{record ? record.level : "No Record"}</TableCell>
                  <TableCell>
                    {record
                      ? new Date(record.date).toLocaleDateString()
                      : "N/A"}
                  </TableCell>
                  <TableCell>{daysSince ?? "N/A"}</TableCell>
                  <TableCell>
                    {record
                      ? `${scheduleInfo.lowerBoundDays}–${scheduleInfo.upperBoundDays} days`
                      : "N/A"}
                  </TableCell>
                  <TableCell>{assessmentRequired ? "Yes" : "No"}</TableCell>
                  <TableCell className="text-xs whitespace-pre-wrap">
                    {message}
                  </TableCell>
                </TableRow>
              ),
            )}
          </TableBody>
        </Table>
      </div>
      {selectedStudent && (
        <CreateRecordDialog
          defaultClassId={defaultClassId}
          studentInfo={studentInfo}
          selectedStudent={selectedStudent}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
        />
      )}
    </div>
  );
};

export default TestTime;
