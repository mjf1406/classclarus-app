"use client";

import React, { useState, useEffect } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

// UI and custom components
import { Button } from "@/components/ui/button";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, Loader2 } from "lucide-react";
import ClassesSelect from "@/components/selects/ClassSelect";
import AssignersSelect from "@/components/selects/AssignerSelect";
import GroupsSelect from "@/components/selects/GroupSelect";
import { PDFGenerator, type AssignedData } from "./PdfGenerator";
import { useAuth } from "@clerk/nextjs";
import { runRandomAssigner } from "../../actions/randomAssigner";

const runAssignerSchema = z.object({
  assignerId: z.string().min(1, "Assigner is required"),
  classId: z.string().min(1, "Class is required"),
  selectedGroups: z.array(z.string()),
});

type RunAssignerFormData = z.infer<typeof runAssignerSchema>;

type AssignerResult = {
  success: boolean;
  data?: AssignedData;
  message?: string;
};

export default function RandomAssignerForm({ classId }: { classId: string }) {
  // Use the passed-in classId as the default for local state.
  const [selectedClass, setSelectedClass] = useState(classId);
  const [isRunning, setIsRunning] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [assignedData, setAssignedData] = useState<AssignedData | null>(null);

  // Retrieve userId from Clerk authentication.
  const { userId } = useAuth();

  // React Hook Form integration with zod.
  const form = useForm<RunAssignerFormData>({
    resolver: zodResolver(runAssignerSchema),
    defaultValues: {
      assignerId: "",
      classId, // Set default form value from prop.
      selectedGroups: [],
    },
  });

  // Update local state and form if the classId prop changes.
  useEffect(() => {
    setSelectedClass(classId);
    form.setValue("classId", classId);
  }, [classId, form]);

  // Handler for form submission using runRandomAssigner()
  const onSubmit = async (data: RunAssignerFormData) => {
    setIsRunning(true);
    setSubmitError(null);
    setSuccessMessage(null);
    setAssignedData(null);

    try {
      const result = (await runRandomAssigner(
        userId,
        data.classId,
        data.assignerId,
        data.selectedGroups,
      )) as AssignerResult;

      if (!result.success) {
        setSubmitError(
          result.message ?? "Failed to run assigner. Please try again.",
        );
      } else {
        setSuccessMessage("Assigner ran successfully.");
        setAssignedData(result.data ?? null);
      }
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "An unexpected error occurred. Please try again.",
      );
      console.error("Submission error:", error);
    } finally {
      setIsRunning(false);
    }
  };

  // When a class is selected from the dropdown, update local state and form.
  const handleClassSelect = (value: string) => {
    setSelectedClass(value);
    form.setValue("classId", value);
  };

  return (
    <div className="max-w-xl space-y-8 p-4">
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-4"
          noValidate
        >
          {/* Class Selection */}
          <FormField
            control={form.control}
            name="classId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Class</FormLabel>
                <ClassesSelect
                  value={selectedClass}
                  onValueChange={handleClassSelect}
                />
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Groups Selection */}
          <FormField
            control={form.control}
            name="selectedGroups"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Groups</FormLabel>
                <GroupsSelect
                  classId={selectedClass}
                  onGroupsSelect={(values) => field.onChange(values)}
                />
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Assigner Selection */}
          <FormField
            control={form.control}
            name="assignerId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Assigner</FormLabel>
                <AssignersSelect
                  value={field.value}
                  onValueChange={(value) => field.onChange(value)}
                  classId={selectedClass}
                />
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Error Alert */}
          {submitError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{submitError}</AlertDescription>
            </Alert>
          )}

          {/* Success Alert */}
          {successMessage && (
            <Alert variant="default">
              <AlertTitle>Success</AlertTitle>
              <AlertDescription>{successMessage}</AlertDescription>
            </Alert>
          )}

          {/* Submit Button */}
          <Button type="submit" disabled={isRunning} className="w-full">
            {isRunning ? (
              <>
                <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                Running...
              </>
            ) : (
              "Run Assigner"
            )}
          </Button>
        </form>
      </Form>

      {/* PDF Generator Section */}
      {assignedData && (
        <div className="mt-4">
          <PDFGenerator data={assignedData} />
        </div>
      )}
    </div>
  );
}
