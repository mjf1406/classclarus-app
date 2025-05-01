/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
"use client";

import React, { useEffect } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createRazRecord } from "../actions/createTestRecord";
import type { StudentClassWithStudent, ClassDetail } from "@/server/db/types";

// Define the Zod schema with coercive number conversion.
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
  date: z.string(),
});

export type NewTestRecordFormData = z.infer<typeof newTestRecordSchema>;

interface CreateRecordFormProps {
  defaultClassId?: string;
  studentInfo: StudentClassWithStudent[];
  selectedStudent?: StudentClassWithStudent;
  onSuccess?: () => void; // callback to close the dialog on success
}

// Define the list of RAZ levels as specified:
// ["aa", "A", "B", ..., "Z", "Z1", "Z2"].
const razLevels: string[] = [
  "aa",
  ...Array.from({ length: 26 }, (_, i) => String.fromCharCode(i + 65)),
  "Z1",
  "Z2",
];

const CreateRecordForm: React.FC<CreateRecordFormProps> = ({
  defaultClassId,
  studentInfo,
  selectedStudent,
  onSuccess,
}) => {
  const getCurrentDateTimeLocal = () => {
    const now = new Date();
    const timezoneOffset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - timezoneOffset).toISOString().slice(0, 16);
  };

  const queryClient = useQueryClient();

  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors, dirtyFields },
    reset,
    setValue,
  } = useForm<NewTestRecordFormData>({
    resolver: zodResolver(newTestRecordSchema),
    defaultValues: {
      class_id: defaultClassId ?? "",
      // Auto‑select the provided student if available.
      student_id: selectedStudent?.student_id ?? "",
      result: "stay",
      // Use the student's reading level as default if available.
      level: selectedStudent?.student_reading_level ?? "",
      accuracy: 0,
      quiz_score: 0,
      retelling_score: 0,
      note: "",
      date: getCurrentDateTimeLocal(),
    },
  });

  const watchAccuracy = watch("accuracy");
  const watchQuizScore = watch("quiz_score");

  const [recommendationMsg, setRecommendationMsg] = React.useState<string>("");

  // When the elected student prop changes, update the student_id field.
  useEffect(() => {
    if (selectedStudent) {
      setValue("student_id", selectedStudent.student_id);
    }
  }, [selectedStudent, setValue]);

  // Compute recommendations based on accuracy and quiz score.
  useEffect(() => {
    const quizPercentage =
      typeof watchQuizScore === "number" ? (watchQuizScore / 5) * 100 : 0;
    let recResult: "level up" | "stay" | "level down" = "stay";

    if (watchAccuracy >= 95) {
      if (Math.round(quizPercentage) === 100) {
        recResult = "level up";
      } else if (quizPercentage >= 80) {
        recResult = "stay";
      } else {
        recResult = "level down";
      }
    } else if (watchAccuracy >= 90) {
      if (quizPercentage >= 80) {
        recResult = "stay";
      } else {
        recResult = "level down";
      }
    } else {
      recResult = "level down";
    }

    const baselineLevel =
      selectedStudent?.student_reading_level?.toUpperCase() ?? "";
    let recLevel = baselineLevel;

    if (baselineLevel && razLevels.includes(baselineLevel)) {
      const idx = razLevels.indexOf(baselineLevel);
      if (recResult === "level up" && idx < razLevels.length - 1) {
        recLevel = razLevels[idx + 1] ?? "";
      } else if (recResult === "level down" && idx > 0) {
        recLevel = razLevels[idx - 1] ?? "";
      }
    }

    setValue("result", recResult);
    setValue("level", recLevel);

    // Prepare the banner message.
    const actionText =
      recResult === "level up"
        ? "Advance Student a Level"
        : recResult === "stay"
          ? "Instruct at this Level"
          : "Lower a Level, Assess Again";

    setRecommendationMsg(
      `With an accuracy of ${watchAccuracy}% and a quiz score of ${Math.round(
        quizPercentage,
      )}%, RAZ recommends <b>${actionText}</b>.`,
    );
  }, [watchAccuracy, watchQuizScore, selectedStudent, setValue]);

  const mutation = useMutation<
    unknown,
    Error,
    NewTestRecordFormData,
    { previousData: ClassDetail | undefined }
  >({
    mutationFn: createRazRecord,
    onMutate: async (newRecord: NewTestRecordFormData) => {
      if (defaultClassId) {
        await queryClient.cancelQueries({
          queryKey: ["classes", defaultClassId],
        });
      }
      const previousData = defaultClassId
        ? queryClient.getQueryData(["classes", defaultClassId])
        : undefined;
      if (defaultClassId) {
        queryClient.setQueryData<ClassDetail>(
          ["classes", defaultClassId],
          (oldData) => {
            return {
              ...oldData,
              raz: [
                ...(oldData?.raz ?? []),
                { ...newRecord, date: new Date().toISOString() },
              ],
              // this verbosity is annoying... how to fix it?
              studentInfo: oldData?.studentInfo ?? [],
              groups: oldData?.groups ?? [],
              subGroups: oldData?.subGroups ?? [],
              rewardItems: oldData?.rewardItems ?? [],
              behaviors: oldData?.behaviors ?? [],
              absentDates: oldData?.absentDates ?? [],
              points: oldData?.points ?? [],
              studentGroups: oldData?.studentGroups ?? [],
              studentSubGroups: oldData?.studentSubGroups ?? [],
            };
          },
        );
      }
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      onSuccess && onSuccess();
      return { previousData: previousData as ClassDetail | undefined };
    },
    onError: (error, newRecord, context) => {
      if (defaultClassId && context?.previousData) {
        queryClient.setQueryData(
          ["classes", defaultClassId],
          context.previousData,
        );
      }
    },
    onSettled: () => {
      if (defaultClassId) {
        void queryClient.invalidateQueries({
          queryKey: ["classes", defaultClassId],
        });
      }
    },
  });

  const onSubmit = (data: NewTestRecordFormData) => {
    mutation.mutate(data, {
      onError: (error: Error) => {
        setServerError(error.message);
      },
    });
  };

  const [serverError, setServerError] = React.useState<string | null>(null);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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

      {/* Accuracy Input */}
      <div className="flex flex-col space-y-1">
        <Label htmlFor="accuracy">Running Record Accuracy Rate (%)</Label>
        <div className="text-xs text-gray-500">
          Input the accuracy percentage without the % symbol.
        </div>
        <Input
          id="accuracy"
          type="number"
          min={0}
          max={100}
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
        <Label htmlFor="quiz_score">
          Quick Check Comprehension Quiz Score (0-5)
        </Label>
        <div className="text-xs text-gray-500">
          Input the number of questions answered correctly.
        </div>
        <Input
          id="quiz_score"
          type="number"
          min={0}
          max={5}
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

      <div className="flex gap-10">
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
      </div>

      {/* eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing */}
      {(dirtyFields.accuracy || dirtyFields.quiz_score) &&
        recommendationMsg && (
          <div
            className="rounded border border-blue-300 bg-blue-100 p-2 text-sm text-blue-700"
            dangerouslySetInnerHTML={{ __html: recommendationMsg }}
          />
        )}

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

      <Button type="submit" disabled={mutation.isPending}>
        {mutation.isPending ? "Creating..." : "Create Record"}
      </Button>
      {serverError && (
        <span className="text-destructive text-sm">{serverError}</span>
      )}
    </form>
  );
};

export default CreateRecordForm;
