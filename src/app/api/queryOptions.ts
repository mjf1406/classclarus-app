import type { Class, ClassDetail, TeacherClass } from "@/server/db/types";
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
  staleTime: 1000 * 60 * 5, // 5 minutes
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
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
