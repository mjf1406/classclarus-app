"use client";

import React from "react";
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
import type { StudentClassWithStudent } from "@/server/db/types";
import NewRazRecordForm from "./CreateRecordForm";

interface CreateRecordDialogProps {
  defaultClassId?: string;
  studentInfo: StudentClassWithStudent[];
  selectedStudent?: StudentClassWithStudent;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const CreateRecordDialog: React.FC<CreateRecordDialogProps> = ({
  defaultClassId,
  studentInfo,
  selectedStudent,
  open,
  onOpenChange,
}) => {
  // When a student is preselected, pass that student exclusively.
  const formStudentInfo = selectedStudent ? [selectedStudent] : studentInfo;

  // Define a success handler that closes the dialog.
  const handleSuccess = () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    onOpenChange && onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Show the trigger only if no student is automatically preselected */}
      {!selectedStudent && (
        <DialogTrigger asChild>
          <Button>
            <Plus /> Create Record
          </Button>
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Test Record</DialogTitle>
          <DialogDescription>
            {selectedStudent
              ? `Creating a new test record for ${selectedStudent.student_name_first_en} ${selectedStudent.student_name_last_en}.`
              : "Fill out the form below to create a new test record."}
          </DialogDescription>
        </DialogHeader>
        <NewRazRecordForm
          defaultClassId={defaultClassId}
          studentInfo={formStudentInfo}
          selectedStudent={selectedStudent}
          onSuccess={handleSuccess}
        />
      </DialogContent>
    </Dialog>
  );
};

export default CreateRecordDialog;
