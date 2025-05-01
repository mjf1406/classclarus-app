"use client";

import React from "react";
import type { RazRecord, StudentClassWithStudent } from "@/server/db/types";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";

interface RazTableProps {
  raz: RazRecord[];
  studentInfo: StudentClassWithStudent[];
}

const RazTable: React.FC<RazTableProps> = ({ raz, studentInfo }) => {
  // Create a map to hold the most recent record for each student.
  const latestRecordsByStudent = new Map<string, RazRecord>();

  // Iterate through all the records and, for each student, store the most recent entry.
  raz.forEach((record) => {
    const studentId = record.student_id;
    const existing = latestRecordsByStudent.get(studentId);
    if (!existing || new Date(record.date) > new Date(existing.date)) {
      latestRecordsByStudent.set(studentId, record);
    }
  });

  const latestRecords = Array.from(latestRecordsByStudent.values());

  // Helper to calculate the number of days between current date and test date.
  const calculateDaysSinceTest = (testDateStr: string): number => {
    const testDate = new Date(testDateStr);
    const currentDate = new Date();
    const msInDay = 1000 * 60 * 60 * 24;
    return Math.floor((currentDate.getTime() - testDate.getTime()) / msInDay);
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Number</TableHead>
          <TableHead>Name</TableHead>
          <TableHead>Days Since Test</TableHead>
          <TableHead>Result</TableHead>
          <TableHead>Level</TableHead>
          <TableHead>Accuracy</TableHead>
          <TableHead>Quiz Score</TableHead>
          <TableHead>Retelling Score</TableHead>
          <TableHead>Note</TableHead>
          <TableHead>Date</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {latestRecords.map((record) => {
          // Find corresponding student info by matching student_id.
          const student = studentInfo.find(
            (s) => s.student_id === record.student_id,
          );
          if (!student)
            return (
              <TableRow key={record.student_id}>
                <TableCell colSpan={11}>Student data not found.</TableCell>
              </TableRow>
            );
          const daysSinceTest = calculateDaysSinceTest(record.date);
          return (
            <TableRow key={record.student_id}>
              <TableCell>{student.student_number ?? "N/A"}</TableCell>
              <TableCell>
                {student.student_name_first_en} {student.student_name_last_en}
              </TableCell>
              <TableCell>{daysSinceTest}</TableCell>
              <TableCell>{record.result}</TableCell>
              <TableCell>{record.level}</TableCell>
              <TableCell>{record.accuracy}</TableCell>
              <TableCell>{record.quiz_score}</TableCell>
              <TableCell>{record.retelling_score}</TableCell>
              <TableCell>{record.note}</TableCell>
              <TableCell>
                {new Date(record.date).toLocaleString(undefined, {
                  dateStyle: "short",
                  timeStyle: "short",
                })}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
};

export default RazTable;
