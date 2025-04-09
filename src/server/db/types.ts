export type UserRole = "teacher" | "admin";

export interface User {
  user_id: string;
  user_name: string;
  user_email: string;
  user_role?: UserRole; // Depending on your application, you might want to treat this as optional
  added_demo?: boolean; // Optional boolean flag (stored as integer)
  joined_date: string; // ISO timestamp string
  updated_date: string; // ISO timestamp string
}

export interface Class {
  class_id: string;
  class_name: string;
  class_language: string;
  class_grade?: "1" | "2" | "3" | "4" | "5" | "6"; // Optional enum value representing grade as string
  class_year?: string;
  class_code: string;
  complete: {
    s1: boolean;
    s2: boolean;
  };
  created_date: string;
  updated_date: string;
}

export type TeacherClassRole = "primary" | "assistant";

export interface TeacherClass {
  assignment_id: string;
  user_id: string; // Reference to a User's user_id
  class_id: string; // Reference to a Class's class_id
  role?: TeacherClassRole; // Optional enum value for teacher role within a class
  assigned_date: string;
}
