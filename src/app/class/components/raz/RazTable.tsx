/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
"use client";

import React, { useTransition } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { createRazRecord } from "./actions/createTestRecord";
import { useQuery } from "@tanstack/react-query";
import { ClassByIdOptions } from "@/app/api/queryOptions";
import type { StudentClassWithStudent } from "@/server/db/types";

// Update the Zod schema to use z.coerce.number() so that each numeric field
// is coercively converted into a number.
const newTestRecordSchema = z.object({
  class_id: z.string().nonempty("Class ID is required"),
  student_id: z.string().nonempty("Student is required"),
  result: z.enum(["level up", "stay", "level down"], {
    required_error: "Result is required",
  }),
  level: z.string().nonempty("Level is required"),
  accuracy: z.coerce.number().int().min(0, {
    message: "Accuracy must be at least 0",
  }),
  quiz_score: z.coerce.number().int().min(0, {
    message: "Quiz score must be at least 0",
  }),
  retelling_score: z.coerce.number().int().min(0, {
    message: "Retelling score must be at least 0",
  }),
  note: z.string().optional(),
  // Convert the string input to a Date (storing as string in the form)
  date: z.string(),
});

export type NewTestRecordFormData = z.infer<typeof newTestRecordSchema>;

interface NewRazRecordFormProps {
  defaultClassId?: string;
  studentInfo: StudentClassWithStudent[];
}

// Define the list of RAZ Kids levels as the English alphabet plus "AA", "Z1", and "Z2"
const razLevels: string[] = [
  "aa",
  ...Array.from({ length: 26 }, (_, i) => String.fromCharCode(i + 65)),
  "Z1",
  "Z2",
];

const NewRazRecordForm: React.FC<NewRazRecordFormProps> = ({
  defaultClassId,
  studentInfo,
}) => {
  // Helper: get the current date/time in "datetime-local" format.
  const getCurrentDateTimeLocal = () => {
    const now = new Date();
    const timezoneOffset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - timezoneOffset).toISOString().slice(0, 16);
  };

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<NewTestRecordFormData>({
    resolver: zodResolver(newTestRecordSchema),
    defaultValues: {
      class_id: defaultClassId ?? "",
      student_id: "",
      result: "stay",
      level: "", // now expecting a select value
      accuracy: 0,
      quiz_score: 0,
      retelling_score: 0,
      note: "",
      date: getCurrentDateTimeLocal(),
    },
  });

  // useTransition allows us to trigger the server action without blocking the UI.
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = React.useState<string | null>(null);

  const onSubmit = (data: NewTestRecordFormData) => {
    startTransition(async () => {
      try {
        const result = await createRazRecord(data);
        if (result.success) {
          reset();
          setServerError(null);
          // Optionally, you can close the dialog or show a success message.
        } else {
          setServerError(result.message ?? "An error occurred.");
        }
      } catch (error: unknown) {
        console.error(error);
        setServerError(
          error instanceof Error ? error.message : "An unknown error occurred.",
        );
      }
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* If a default class ID exists, render it as a hidden field. */}
      {defaultClassId && <input type="hidden" {...register("class_id")} />}

      {/* Student Selector */}
      <div className="flex flex-col space-y-1">
        <Label htmlFor="student_id">Student</Label>
        <Controller
          control={control}
          name="student_id"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select a student" />
              </SelectTrigger>
              <SelectContent>
                {studentInfo.map((record) => (
                  <SelectItem key={record.student_id} value={record.student_id}>
                    {record.student_number ?? "No Number"} -{" "}
                    {record.student_name_first_en} {record.student_name_last_en}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {errors.student_id && (
          <span className="text-destructive text-sm">
            {errors.student_id.message}
          </span>
        )}
      </div>

      {/* Result Selector */}
      <div className="flex flex-col space-y-1">
        <Label htmlFor="result">Result</Label>
        <Controller
          control={control}
          name="result"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select a result" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="level up">Level Up</SelectItem>
                <SelectItem value="stay">Stay</SelectItem>
                <SelectItem value="level down">Level Down</SelectItem>
              </SelectContent>
            </Select>
          )}
        />
        {errors.result && (
          <span className="text-destructive text-sm">
            {errors.result.message}
          </span>
        )}
      </div>

      {/* Level Selector */}
      <div className="flex flex-col space-y-1">
        <Label htmlFor="level">Level</Label>
        <Controller
          control={control}
          name="level"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select a level" />
              </SelectTrigger>
              <SelectContent>
                {razLevels.map((level) => (
                  <SelectItem key={level} value={level}>
                    {level}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {errors.level && (
          <span className="text-destructive text-sm">
            {errors.level.message}
          </span>
        )}
      </div>

      {/* Accuracy Input */}
      <div className="flex flex-col space-y-1">
        <Label htmlFor="accuracy">Accuracy</Label>
        <Input
          id="accuracy"
          type="number"
          {...register("accuracy", { valueAsNumber: true })}
        />
        {errors.accuracy && (
          <span className="text-destructive text-sm">
            {errors.accuracy.message}
          </span>
        )}
      </div>

      {/* Quiz Score Input */}
      <div className="flex flex-col space-y-1">
        <Label htmlFor="quiz_score">Quiz Score</Label>
        <Input
          id="quiz_score"
          type="number"
          {...register("quiz_score", { valueAsNumber: true })}
        />
        {errors.quiz_score && (
          <span className="text-destructive text-sm">
            {errors.quiz_score.message}
          </span>
        )}
      </div>

      {/* Retelling Score Input */}
      <div className="flex flex-col space-y-1">
        <Label htmlFor="retelling_score">Retelling Score</Label>
        <Input
          id="retelling_score"
          type="number"
          {...register("retelling_score", { valueAsNumber: true })}
        />
        {errors.retelling_score && (
          <span className="text-destructive text-sm">
            {errors.retelling_score.message}
          </span>
        )}
      </div>

      {/* Note Field */}
      <div className="flex flex-col space-y-1">
        <Label htmlFor="note">Note</Label>
        <Textarea id="note" {...register("note")} />
        {errors.note && (
          <span className="text-destructive text-sm">
            {errors.note.message}
          </span>
        )}
      </div>

      {/* Date and Time Input */}
      <div className="flex flex-col space-y-1">
        <Label htmlFor="date">Date and Time</Label>
        <Input id="date" type="datetime-local" {...register("date")} />
        {errors.date && (
          <span className="text-destructive text-sm">
            {errors.date.message}
          </span>
        )}
      </div>

      <Button type="submit" disabled={isPending}>
        {isPending ? "Creating..." : "Create Record"}
      </Button>
      {serverError && (
        <span className="text-destructive text-sm">{serverError}</span>
      )}
    </form>
  );
};

interface RazTableProps {
  classId: string | null;
}

const RazTable: React.FC<RazTableProps> = ({ classId }) => {
  // Fetch class data using the provided classId.
  const { data, error, isLoading } = useQuery(ClassByIdOptions(classId));

  if (isLoading) {
    return <p>Loading class data...</p>;
  }

  if (error || !data) {
    return <p>Error loading class data.</p>;
  }

  const { studentInfo } = data;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>
          <Plus /> Create Record
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Test Record</DialogTitle>
          <DialogDescription>
            Fill out the form below to create a new test record.
          </DialogDescription>
        </DialogHeader>
        <NewRazRecordForm
          defaultClassId={classId ?? undefined}
          studentInfo={studentInfo}
        />
      </DialogContent>
    </Dialog>
  );
};

export default RazTable;
