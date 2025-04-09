import type { Class, TeacherClass } from '@/server/db/types';
import { queryOptions } from '@tanstack/react-query'

export type TeacherClassDetail = {
    teacherAssignment: TeacherClass;
    classInfo: Class;
  }
  
  export const TeacherClassesOptions = queryOptions<TeacherClassDetail[]>({
    queryKey: ["teacher-classes"],
    queryFn: async () => {
      const response = await fetch("/api/teacher-classes");
      return response.json() as unknown as TeacherClassDetail[];
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });