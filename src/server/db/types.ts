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

export interface StudentClassWithStudent extends StudentClass, Student {}

// Define a comprehensive type for the API response.
export interface ClassDetail {
  studentInfo: StudentClassWithStudent[];
  groups: Group[];
  subGroups: SubGroup[];
  rewardItems: RewardItem[];
  behaviors: Behavior[];
  absentDates: AbsentDate[];
  points: Point[];
  studentGroups: StudentGroup[];
  studentSubGroups: StudentSubGroup[];
}

// Assuming these types are defined elsewhere
export type PointRecord = {
  point_id: string;
  quantity: number;
  date: string;
}

export type RedemptionRecord = {
  item_id: string,
  date: string,
  quantity: number,
}

export interface Student {
  student_id: string;
  student_name_en?: string;
  student_name_first_en: string;
  student_name_last_en: string;
  student_name_alt?: string;
  student_reading_level?: string;
  student_grade?: string;
  student_sex?: "male" | "female";
  student_number?: number;
  student_email?: string;
  joined_date: string;
  updated_date: string;
}

export interface Group {
  group_id: string;
  group_name: string;
  class_id: string;
  created_date: string;
  updated_date: string;
}

export interface SubGroup {
  sub_group_id: string;
  group_id: string;
  sub_group_name: string;
  class_id: string;
  created_date: string;
  updated_date: string;
}

export interface RewardItem {
  item_id: string;
  class_id?: string; // notNotNull: optional if not provided
  user_id: string;
  price: number;
  name: string;
  description?: string;
  icon?: string;
  type: "solo" | "group" | "class";
  title?: string;
  created_date: string;
  updated_date: string;
}

export interface Behavior {
  behavior_id: string;
  class_id: string;
  user_id: string;
  name: string;
  point_value: number;
  description?: string;
  icon?: string;
  color?: string;
  title?: string;
  created_date: string;
  updated_date: string;
}

export interface StudentClass {
  enrollment_id: string;
  student_id: string;
  class_id: string;
  enrollment_date: string;
  points?: number;
  point_history?: PointRecord[];
  redemption_history?: RedemptionRecord[];
  absent_dates?: string[];
}

export interface StudentGroup {
  enrollment_id: string;
  group_id: string;
  student_id: string;
  enrollment_date: string;
}

export interface StudentSubGroup {
  enrollment_id: string;
  sub_group_id: string;
  student_id: string;
  enrollment_date: string;
}

export interface AbsentDate {
  id: string;
  user_id: string;
  class_id: string;
  student_id: string;
  date: string; // expected to be in format YYYY-MM-DD
  created_date: string;
  updated_date: string;
}

export interface Point {
  id: string;
  user_id: string;
  class_id: string;
  student_id: string;
  behavior_id?: string;
  reward_item_id?: string;
  type: "positive" | "negative" | "redemption";
  number_of_points: number;
  created_date: string;
  updated_date: string;
}
