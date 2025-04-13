"use server";

import { auth, clerkClient } from "@clerk/nextjs/server"; // Clerk authentication and client
import { google } from "googleapis";
import { eq } from "drizzle-orm"; // Import eq from Drizzle ORM
import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { student_classes, students } from "@/server/db/schema";
import pLimit from "p-limit";
import { retry } from "@/lib/utils";

// Removed the unused GoogleTokens interface

export async function sendEmails(input: { classId: string }) {
  const { classId } = input;

  // Validate input
  if (!classId) {
    throw new Error("Missing classId.");
  }

  const { userId } = await auth();

  // Check authentication
  if (!userId) {
    throw new Error("Unauthorized.");
  }

  const clerkResponse = await clerkClient();
  //   const users = await clerkResponse.users.getUserOauthAccessToken(userId, 'oauth_google'); // This way is deprecated
  const users = await clerkResponse.users.getUserOauthAccessToken(
    userId,
    "google",
  );
  const accessToken = users.data[0]?.token;

  if (!accessToken) {
    return NextResponse.json(
      { message: "Failed to retrieve Google OAuth token" },
      { status: 401 },
    );
  }
  if (typeof accessToken !== "string") {
    NextResponse.json(
        { message: "Access token is not a string" },
        { status: 401 },
      );
  }
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
  const authClient = new google.auth.OAuth2();
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
  authClient.setCredentials({ access_token: accessToken });

  // Initialize Gmail client
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
  const gmailClient = google.gmail({ version: "v1", auth: authClient });

  // Fetch student records for the given class
  const studentRecords = await db
    .select()
    .from(student_classes)
    .leftJoin(students, eq(student_classes.student_id, students.student_id))
    .where(eq(student_classes.class_id, classId))
    .execute();

  if (!studentRecords || studentRecords.length === 0) {
    throw new Error("No students found for this class.");
  }

  // Function to create a raw email in base64url format
  const createRawEmail = (
    to: string,
    classId: string,
    studentId: string,
  ): string => {
    const dashboardUrl = `https://app.classclarus.com/classes/${classId}/students/${studentId}`;
    const emailContent = [
      `To: ${to}`,
      "Content-Type: text/html; charset=UTF-8",
      `Subject: ClassClarus Dashboard`,
      "",
      `<p>Hey there, ${"ClassClarus"}er!</p>
       <p>Do NOT share this link with anyone! Also, please add the below link to your Bookmarks bar so you can easily access it later.</p>
       <p>Please access your dashboard using the link below:</p>
       <a href="${dashboardUrl}">Go to your ${"ClassClarus"} Dashboard</a>`,
    ].join("\n");

    return Buffer.from(emailContent)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  };

  // Send Emails
  const limit = pLimit(5);

  const sendEmailTasks = studentRecords.map((record) => {
    return limit(async () => {
      const email = record.students?.student_email;
      const studentId = record.student_classes.student_id;
      if (!email) {
        console.warn(`Email not found for student ID ${studentId}. Skipping.`);
        return;
      }
  
      const raw = createRawEmail(email, classId, studentId);
      await retry(() =>
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        gmailClient.users.messages.send({
          userId: "me",
          requestBody: { raw },
        })
      );
      
    });
  });
  
  try {
    await Promise.all(sendEmailTasks);
    console.log("All emails have been processed.");
  } catch (error) {
    console.error("An error occurred while sending emails:", error);
    throw new Error("Some emails could not be sent.");
  }
}
