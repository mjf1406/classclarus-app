import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/server/db";
import { expectations, student_expectations } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ExpectationData {
  id: string;
  student_id: string;
  class_id: string;
  value: string | null;
  number: number | null;
  expectation_name: string;
  expectation_description: string | null;
  expectation_class_id: string;
}

export default async function ExpectationsCard({
  params,
}: {
  params: Promise<{ classId: string; studentId: string }>;
}) {
  const { classId, studentId } = await params;

  const data: ExpectationData[] = await db
    .select({
      id: student_expectations.id,
      student_id: student_expectations.student_id,
      class_id: student_expectations.class_id,
      value: student_expectations.value,
      number: student_expectations.number,
      expectation_name: expectations.name,
      expectation_description: expectations.description,
      expectation_class_id: expectations.class_id,
    })
    .from(student_expectations)
    .innerJoin(
      expectations,
      eq(student_expectations.expectation_id, expectations.id),
    )
    .where(
      and(
        eq(student_expectations.student_id, studentId),
        eq(student_expectations.class_id, classId),
      ),
    );

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Expectations</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No expectations set yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mx-auto w-full">
      <CardHeader>
        <CardTitle>Expectations</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="secondary" className="w-full">
                View Details
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Student Expectations</DialogTitle>
                <DialogDescription>
                  Detailed view of all expectations and their current status
                </DialogDescription>
              </DialogHeader>
              <ScrollArea className="max-h-[60vh]">
                <div className="space-y-6 pr-4">
                  {data.map((exp) => (
                    <div key={exp.id} className="rounded-lg border p-4">
                      <h3 className="mb-2 text-lg font-semibold">
                        {exp.expectation_name}:{" "}
                        <span className="text-primary">
                          {exp.value ?? exp.number}
                        </span>
                      </h3>
                      {exp.expectation_description && (
                        <p className="mb-4">{exp.expectation_description}</p>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </DialogContent>
          </Dialog>
          {data.map((exp) => (
            <div key={exp.id} className="bg-background rounded-lg border p-3">
              <h4 className="font-medium">
                {exp.expectation_name}:{" "}
                <span className="text-primary">{exp.value ?? exp.number}</span>
              </h4>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
