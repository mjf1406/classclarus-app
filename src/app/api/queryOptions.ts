import type {
  Assigner,
  Class,
  ClassDetail,
  GradedSubject,
  GradeScale,
  Point,
  Report,
  TeacherClass,
} from "@/server/db/types";
import { queryOptions } from "@tanstack/react-query";
import type { Assignment } from "../class/components/gradebook/graded-assignments/GradedAssignmentsList";
import type { CenturySkill, SubjectComment } from "@/server/db/schema";

export type TeacherClassDetail = {
  teacherAssignment: TeacherClass;
  classInfo: Class;
};

export const TeacherClassesOptions = queryOptions<TeacherClassDetail[]>({
  queryKey: ["teacher-classes"],
  queryFn: async () => {
    const response = await fetch("/api/teacher-classes");
    return response.json() as unknown as TeacherClassDetail[];
  },
  staleTime: 1000 * 60 * 30, // 30 minutes
});

export const ClassByIdOptions = (classId: string | null) =>
  queryOptions<ClassDetail>({
    queryKey: ["classes", classId],
    queryFn: async () => {
      // Make sure to use the dynamic route if needed:
      const response = await fetch(`/api/class-by-id?class_id=${classId}`);
      if (!response.ok) {
        throw new Error(
          "Failed to load this class's data. Please refresh the page.",
        );
      }
      return (await response.json()) as ClassDetail;
    },
    staleTime: 1000 * 60 * 30, // 30 minutes
  });

export const PointsByClassIdOptions = (classId: string | null) =>
  queryOptions<Point[]>({
    queryKey: ["points", classId],
    queryFn: async () => {
      const response = await fetch(
        `/api/points-by-class-id?class_id=${classId}`,
      );
      if (!response.ok) {
        throw new Error("Failed to load points data. Please refresh the page.");
      }
      return (await response.json()) as Point[];
    },
    staleTime: 1000 * 60 * 30, // 30 minutes
  });

export const AssignersOptions = (classId: string | null) =>
  queryOptions<Assigner[]>({
    queryKey: ["assigners", classId],
    queryFn: async () => {
      const response = await fetch(
        `/api/assigners-by-class-id?class_id=${classId}`,
      );
      if (!response.ok) {
        throw new Error(
          "Failed to load assigners data. Please refresh the page.",
        );
      }
      return (await response.json()) as Assigner[];
    },
    staleTime: 1000 * 60 * 30, // 30 minutes
  });

export const RandomizersOptions = (classId: string | null) =>
  queryOptions<Assigner[]>({
    queryKey: ["randomizer", classId],
    queryFn: async () => {
      const response = await fetch(
        `/api/randomizer-by-class-id?class_id=${classId}`,
      );
      if (!response.ok) {
        throw new Error(
          "Failed to load randomizer data. Please refresh the page.",
        );
      }
      return (await response.json()) as Assigner[];
    },
    staleTime: 1000 * 60 * 30, // 30 minutes
  });

export const GradedAssignmentOptions = (classId: string | null) =>
  queryOptions<Assignment[]>({
    queryKey: ["graded_assignments", classId],
    queryFn: async () => {
      const response = await fetch(
        `/api/graded-assignments-by-class-id?class_id=${classId}`,
      );
      if (!response.ok) {
        throw new Error(
          "Failed to load graded assignments data. Please refresh the page.",
        );
      }
      return (await response.json()) as Assignment[];
    },
    // staleTime: 1000 * 60 * 30, // 30 minutes
  });

export const GradeScaleOptions = (userId: string | null) =>
  queryOptions<GradeScale[]>({
    queryKey: ["grade_scales", userId],
    queryFn: async () => {
      const response = await fetch(`/api/grade-scales-by-user-id`);
      if (!response.ok) {
        throw new Error(
          "Failed to load grade scales data. Please refresh the page.",
        );
      }
      return (await response.json()) as GradeScale[];
    },
    staleTime: 1000 * 60 * 30, // 30 minutes
  });

export const GradedSubjectsOptions = (classId: string | null) =>
  queryOptions<GradedSubject[]>({
    queryKey: ["graded_subjects", classId],
    queryFn: async () => {
      const response = await fetch(
        `/api/graded-subjects-by-class-id?class_id=${classId}`,
      );
      if (!response.ok) {
        throw new Error(
          "Failed to load graded subjects data. Please refresh the page.",
        );
      }
      return (await response.json()) as GradedSubject[];
    },
    staleTime: 1000 * 60 * 30, // 30 minutes
  });

export const ReportOptions = (classId: string | null) =>
  queryOptions<Report[]>({
    queryKey: ["reports", classId],
    queryFn: async () => {
      const response = await fetch(
        `/api/reports-by-class-id?class_id=${classId}`,
      );
      if (!response.ok) {
        throw new Error("Failed to load report data. Please refresh the page.");
      }
      return (await response.json()) as Report[];
    },
    staleTime: 1000 * 60 * 30, // 30 minutes
  });

export const CenturySkillsOptions = (classId: string | null) =>
  queryOptions<CenturySkill[]>({
    queryKey: ["century_skills", classId],
    queryFn: async () => {
      const response = await fetch(
        `/api/century-skills-by-class-id?class_id=${classId}`,
      );
      if (!response.ok) {
        throw new Error(
          "Failed to load graded subjects data. Please refresh the page.",
        );
      }
      return (await response.json()) as CenturySkill[];
    },
    staleTime: 1000 * 60 * 30, // 30 minutes
  });

export const SubjectCommentsOptions = (userId: string) =>
  queryOptions<SubjectComment[]>({
    queryKey: ["subject_comments", userId],
    queryFn: async () => {
      const response = await fetch(`/api/subject-comments-by-user-id`);
      if (!response.ok) {
        throw new Error(
          "Failed to load subject comments data. Please refresh the page.",
        );
      }
      return (await response.json()) as SubjectComment[];
    },
    staleTime: 1000 * 60 * 30,
  });
