import type {
  Assigner,
  Class,
  ClassDetail,
  Point,
  TeacherClass,
} from "@/server/db/types";
import { queryOptions } from "@tanstack/react-query";

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
