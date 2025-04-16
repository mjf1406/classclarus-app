"use server";

import { formatDate, generateUuidWithPrefix } from "@/lib/helperFunctions";
import { db } from "@/server/db";
import { raz } from "@/server/db/schema";
import { auth } from "@clerk/nextjs/server";

export interface NewRazRecordData {
  class_id: string;
  student_id: string;
  result: "level up" | "stay" | "level down";
  level: string;
  accuracy: number;
  quiz_score: number;
  retelling_score: number;
  note?: string;
  date: string,
}

export async function createRazRecord(data: NewRazRecordData) {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("User not authenticated.");

    const formattedDate = formatDate(data.date); // Convert the date

    await db.insert(raz).values({
      id: generateUuidWithPrefix("raz_"),
      user_id: userId,
      class_id: data.class_id,
      student_id: data.student_id,
      result: data.result,
      level: data.level.toUpperCase(),
      accuracy: data.accuracy,
      quiz_score: data.quiz_score,
      retelling_score: data.retelling_score,
      note: data.note,
      date: formattedDate,
    });

    return { success: true, message: null };
  } catch (error: unknown) {
    console.error(error);

    if (error instanceof Error) {
      return { success: false, message: error.message };
    }
    return { success: false, message: "An unknown error occurred." };
  }
}

