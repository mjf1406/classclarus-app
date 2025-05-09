"use server";

import { db } from "@/server/db/index";
import {
  classes as classesTable,
  teacher_classes as teacherClassesTable,
  students as studentsTable,
  student_classes as studentClassesTable,
} from "@/server/db/schema";
import { randomUUID } from "crypto";
import { auth } from '@clerk/nextjs/server';
import { generateUniqueClassCode } from "@/lib/classCode";
import { createRazRecord, type NewRazRecordData } from "../components/raz/actions/createTestRecord";
import { formatDate } from "@/lib/helperFunctions";

export type ClassGrade = "1" | "2" | "3" | "4" | "5" | "6";
export type Role = "primary" | "assistant";
export type UserRole = "teacher" | "admin";

export type Student = {
  student_id: string;
  student_name_en: string;
  student_name_first_en: string;
  student_name_last_en: string;
  student_name_alt: string | undefined;
  student_grade: string | undefined;
  student_reading_level: string | undefined;
  student_sex: "male" | "female" | null;
  student_number: number | null;
  student_email: string | null;
  joined_date?: string;
  updated_date?: string;
};

type ClassData = {
  class_id: string;
  class_name: string;
  class_language: string;
  class_grade: ClassGrade;
  class_year: string | undefined;
  class_code: string;
  archived: boolean,
  complete: {
    s1: boolean;
    s2: boolean;
  };
};

export type Data = {
  class_id: string | undefined;
  class_name: string;
  class_language: string;
  class_grade: ClassGrade;
  class_year: string | undefined;
  role: Role;
  fileContents: string;
};

type TeacherClassData = {
  assignment_id: string;
  user_id: string;
  class_id: string;
  role: Role;
};

export type StudentId = {
  sid: string;
  fid: string;
};

export type CSVStudent = Record<string, string | undefined>;

function generateUuidWithPrefix(prefix: string) {
  return `${prefix}${randomUUID()}`;
}

function csvToJson(csvString: string): CSVStudent[] {
  const lines = csvString.split("\n");
  const result: CSVStudent[] = [];
  const headers = lines[0]?.split(",") ?? [];

  for (let i = 1; i < lines.length; i++) {
    const obj: CSVStudent = {};
    const currentline = lines[i]?.split(",") ?? [];

    if (headers.length > 0 && currentline && currentline.length === headers.length) {
      for (let j = 0; j < headers.length; j++) {
        const header = headers[j]?.trim();
        if (header === undefined) continue;
        obj[header] = currentline[j]?.trim() ?? "";
      }
      result.push(obj);
    }
  }
  return result;
}

export default async function createClass(
  data: Data,
  complete: boolean | undefined | null,
  source: "template" | "google-classroom"
) {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("User ID is null");
  }
  if (!data.class_language) {
    data.class_language = "en-US";
  }

  // Generate IDs and prepare arrays that will be used in the insertions.
  const classId = generateUuidWithPrefix("class_");
  const assignmentId = generateUuidWithPrefix("assignment_");
  const studentClassesData: { enrollment_id: string; student_id: string; class_id: string }[] = [];
  const studentIds: StudentId[] = [];
  const studentsData: Student[] = [];
  const razData: NewRazRecordData[] = []
  
  try {
    // Insert the class first.
    const classData: ClassData = {
      class_id: classId,
      class_name: data.class_name,
      class_language: data.class_language,
      class_grade: data.class_grade,
      class_year: data.class_year,
      class_code: await generateUniqueClassCode(),
      archived: false,
      complete: complete ? { s1: true, s2: true } : { s1: false, s2: false },
    };
    // console.log("🚀 ~ classData:", classData)
    await db.insert(classesTable).values(classData);
    // console.log("⭐ Class inserted!");

    // Insert the teacher-class assignment.
    const teacherClassData: TeacherClassData = {
      assignment_id: assignmentId,
      user_id: userId,
      class_id: classId,
      role: data.role,
    };
    // console.log("🚀 ~ teacherClassData:", teacherClassData)
    await db.insert(teacherClassesTable).values(teacherClassData);
    // console.log("⭐ Teacher added!");

    // Convert the CSV file contents into JSON.
    let studentsJson = csvToJson(data.fileContents);
    // Filter out rows missing required fields.
    studentsJson = studentsJson.filter((i) => i.name_first_en !== "" && i.grade !== "");
    // console.log("🚀 ~ studentsJson:", studentsJson)

    // Prepare students and enrollments.
    for (const student of studentsJson) {
      if (!student.name_first_en) {
        console.warn(`Skipping student due to missing required field: ${JSON.stringify(student)}`);
        continue;
      }

      const fieldId = generateUuidWithPrefix("field_");
      const studentId = generateUuidWithPrefix("student_");
      const enrollmentId = generateUuidWithPrefix("enrollment_");

      studentIds.push({
        sid: studentId,
        fid: fieldId,
      });

      const stud: Student = {
        student_id: studentId,
        student_name_en: student.name_en ?? "",
        student_name_first_en: student.name_first_en ?? "",
        student_name_last_en: student.name_last_en ?? "",
        student_name_alt: student.name_alt,
        student_grade: student.grade,
        student_reading_level: student.reading_level,
        student_sex: student.sex === "male" || student.sex === "female" ? student.sex : null,
        student_number: student.number ? parseInt(student.number, 10) : null,
        student_email:
          !student.email || student.email === "" || student.email === "null" ? null : student.email,
      };
      studentsData.push(stud);

      // Prepare enrollment for the student.
      studentClassesData.push({
        enrollment_id: enrollmentId,
        student_id: studentId,
        class_id: classId,
      });

      if (student.raz_level) {

        razData.push({
          id: generateUuidWithPrefix("raz_"),
          user_id: userId,
              class_id: classId,
              student_id: studentId,
              result: 'stay',
              level: student.raz_level,
              accuracy: 0,
              quiz_score: 0,
              retelling_score: 0,
              note: '',
              date: formatDate(new Date().toString()),
            })
          }
            
    }

    // Insert students if there are any.
    if (studentsData.length > 0) {
        await db.insert(studentsTable).values(studentsData);
        // console.log("⭐ Students inserted!");
    }
    if (razData.length > 0) {
      for (const record of razData) {
        await createRazRecord(record)
      }
    }
} catch (error) {
    console.error("Insertion of class, teacher, and students failed.", error);
    throw error;
}

// Insert student-class enrollments sequentially.
    // console.log("🚀 ~ studentClassesData:", studentClassesData)
  try {
    if (studentClassesData.length > 0) {
      await db.insert(studentClassesTable).values(studentClassesData);
      // console.log("⭐ Students added to class!");
    }
  } catch (error) {
    console.error("Insertion of student enrollments failed.", error);
    throw error;
  }

  // Revalidate the path after all insertions have completed.
  return JSON.stringify(studentIds);
}
