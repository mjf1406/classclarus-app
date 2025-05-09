"use client";

import React, { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  MoreVertical,
  SquarePen,
  Trash2,
  Mail,
  Loader2,
  Copy,
  HelpCircle,
  Archive,
} from "lucide-react";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import {
  TeacherClassesOptions,
  type TeacherClassDetail,
} from "@/app/api/queryOptions";
import { cn } from "@/lib/utils";
import { sendEmails } from "../actions/sendStudentDashboardEmails";
import deleteClass from "../actions/deleteClass";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { archiveClassById } from "../actions/archiveClassById";

interface ClassActionMenuProps {
  classId: string;
  className?: string;
}

const ClassActionMenu: React.FC<ClassActionMenuProps> = ({
  classId,
  className,
}) => {
  const queryClient = useQueryClient();
  const [deleteCourseText, setDeleteCourseText] = useState("");
  // Use a controlled state for the deletion dialog
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [isSendingEmails, startTransition] = useTransition();

  const { data, isLoading, isError, error } = useQuery<TeacherClassDetail[]>(
    TeacherClassesOptions,
  );

  if (isLoading) {
    return (
      <div className="m-auto flex w-full max-w-4xl items-center justify-center lg:min-w-3xl">
        <Loader2 className="h-24 w-24 animate-spin" />
      </div>
    );
  }
  if (isError || error) {
    return (
      <div className="m-auto flex h-auto w-full items-center justify-center">
        <div className="max-w-5xl px-4">
          <Alert
            variant="destructive"
            className="flex w-full items-center gap-4"
          >
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error.message}</AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  const course = data?.find((i) => i.classInfo.class_id === classId);

  // Delete mutation
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const deleteMutation = useMutation({
    mutationFn: (classId: string) =>
      deleteClass(classId, course?.teacherAssignment.role ?? ""),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: TeacherClassesOptions.queryKey,
      });
      toast.success(
        `Class "${course?.classInfo.class_name}" has been successfully deleted.`,
      );
      setOpenDeleteDialog(false);
      setDeleteCourseText("");
    },
    onError: () => {
      toast.error("Failed to delete class! Please try again in a moment.");
    },
  });

  // Archive mutation with optimistic update
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const archiveMutation = useMutation({
    mutationFn: (classId: string) =>
      archiveClassById(classId, course?.teacherAssignment.role ?? ""),
    onMutate: async (classId: string) => {
      await queryClient.cancelQueries({ queryKey: ["teacher-classes"] });
      const previousData = queryClient.getQueryData<TeacherClassDetail[]>([
        "teacher-classes",
      ]);
      queryClient.setQueryData<TeacherClassDetail[]>(
        ["teacher-classes"],
        (old) =>
          old?.map((cls) =>
            cls.classInfo.class_id === classId
              ? {
                  ...cls,
                  classInfo: { ...cls.classInfo, archived: true },
                }
              : cls,
          ) ?? [],
      );
      return { previousData };
    },
    onError: (error, classId, context) => {
      queryClient.setQueryData(["teacher-classes"], context?.previousData);
      toast.error("Failed to archive class! Please try again in a moment.");
    },
    onSuccess: () => {
      toast.success(
        `${course?.classInfo.class_name} has been successfully archived.`,
      );
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: ["teacher-classes"],
      });
    },
  });

  const copyToClipboard = () => {
    navigator.clipboard
      .writeText(
        `https://app.classclarus.com/import?import_code=${course?.classInfo.class_code}`,
      )
      .then(
        () => {
          toast.success(
            "Class behavior/rewards share link has been copied to your clipboard.",
          );
        },
        (err) => {
          console.error("Could not copy text: ", err);
          toast.error("Failed to copy class code.");
        },
      );
  };

  const handleSendEmails = () => {
    startTransition(async () => {
      try {
        await sendEmails({ classId });
        toast.success(
          "Emails Sent! It can take up to several hours for the emails to arrive.",
        );
      } catch (error: unknown) {
        console.error("Error sending emails:", error);
        toast.error(
          `Failed to send emails! ${
            error instanceof Error
              ? error.message
              : "An error occurred while sending emails."
          }`,
        );
      }
    });
  };

  const handleCopyClassCode = () => {
    navigator.clipboard
      .writeText(
        `https://app.classclarus.com/classes?join_code=${course?.classInfo.class_code}`,
      )
      .then(
        () => {
          toast.success("Class invite link has been copied to your clipboard.");
        },
        (err) => {
          console.error("Could not copy text: ", err);
          toast.error("Failed to copy class code.");
        },
      );
  };

  const handleArchiveClass = () => {
    archiveMutation.mutate(classId);
  };

  const handleDeleteClass = () => {
    if (course?.classInfo.class_name !== deleteCourseText) {
      toast.warning(
        "Class names do not match! This is case-sensitive. Please check your input.",
      );
      return;
    }
    deleteMutation.mutate(classId);
  };

  return (
    <Dialog
      open={openDeleteDialog}
      onOpenChange={(open) => setOpenDeleteDialog(open)}
      modal={openDeleteDialog}
      // onOpenChange={() => {
      //   setTimeout(() => (document.body.style.pointerEvents = ""), 100);
      // }}
    >
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size={"icon"} className={cn(className)}>
            <MoreVertical className="h-5 w-5" />
            <span className="sr-only">Open menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="border-secondary border" align="end">
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          <DropdownMenuItem asChild>
            <Link href={`/classes/${classId}/edit`}>
              <SquarePen className="mr-2 h-4 w-4" />
              Edit
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={copyToClipboard}>
            <Copy className="mr-2 h-4 w-4" />
            Share behaviors/rewards
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={handleSendEmails}
            disabled={isSendingEmails}
          >
            <Mail className="mr-2 h-4 w-4" />
            Email dashboards
            <TooltipProvider>
              <Tooltip delayDuration={0}>
                <TooltipTrigger>
                  <HelpCircle className="ml-1" size={16} />
                </TooltipTrigger>
                <TooltipContent className="max-w-sm">
                  <p>
                    It may take up to several hours for the emails to arrive. In
                    testing, they never took more than 10 minutes.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={handleCopyClassCode}
            disabled={isSendingEmails}
          >
            <Copy className="mr-2 h-4 w-4" />
            Invite teachers
            <TooltipProvider>
              <Tooltip delayDuration={0}>
                <TooltipTrigger>
                  <HelpCircle className="ml-1" size={16} />
                </TooltipTrigger>
                <TooltipContent className="max-w-sm">
                  <p>
                    This will copy your class code. Send it to other teachers so
                    they can join as assistant teachers.
                    <strong>
                      {" "}
                      (Assistant teachers can only apply behaviors and
                      mark/unmark tasks complete.)
                    </strong>
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={handleArchiveClass}
            disabled={isSendingEmails || archiveMutation.isPending}
          >
            <Archive className="mr-2 h-4 w-4" />
            Archive class
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {/* When the delete item is clicked, open the dialog */}
          <DialogTrigger asChild>
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              className="text-destructive hover:!bg-destructive hover:text-foreground flex cursor-pointer items-center font-bold"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Delete
            </DropdownMenuItem>
          </DialogTrigger>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Delete Confirmation Dialog */}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete class</DialogTitle>
          <DialogDescription>
            Please type the class name{" "}
            <span className="font-bold">{course?.classInfo.class_name}</span>{" "}
            below to confirm deletion. This action is <b>IRREVERSIBLE</b>.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center space-x-2">
          <div className="grid flex-1 gap-2">
            <Label htmlFor="class-to-delete" className="sr-only">
              Class to delete
            </Label>
            <Input
              id="class-to-delete"
              placeholder="Type class name"
              value={deleteCourseText}
              onChange={(e) => setDeleteCourseText(e.target.value)}
              disabled={isSendingEmails || deleteMutation.isPending}
            />
          </div>
        </div>
        <DialogFooter className="sm:justify-start">
          <DialogClose asChild>
            <Button
              type="button"
              variant="outline"
              disabled={isSendingEmails || deleteMutation.isPending}
            >
              Cancel
            </Button>
          </DialogClose>
          <Button
            onClick={handleDeleteClass}
            variant="destructive"
            disabled={deleteMutation.isPending || isSendingEmails}
          >
            {deleteMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                Deleting...
              </>
            ) : (
              "Delete class"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ClassActionMenu;
