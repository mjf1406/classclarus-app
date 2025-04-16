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
}

const CreateRecordDialog: React.FC<CreateRecordDialogProps> = ({
  defaultClassId,
  studentInfo,
}) => {
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
          defaultClassId={defaultClassId}
          studentInfo={studentInfo}
        />
      </DialogContent>
    </Dialog>
  );
};

export default CreateRecordDialog;
