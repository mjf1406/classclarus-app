// src/app/class/components/gradebook/reports/SubjectCommentsDialog.tsx
"use client";

import * as React from "react";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Upload, Loader2 } from "lucide-react";
import type { Report } from "@/server/db/types";
import { useUpdateSubjectComment } from "./hooks/useUpdateSubjectComments";
import { useAuth } from "@clerk/nextjs";

interface SubjectCommentsDialogProps {
  report: Report;
  trigger: React.ReactNode;
}

export default function SubjectCommentsDialog({
  report,
  trigger,
}: SubjectCommentsDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const { userId } = useAuth();
  if (!userId) throw new Error("Not authenticated");
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const updateComment = useUpdateSubjectComment(report.id);

  // Check if we're loading (either processing file or uploading)
  const isLoading = isProcessing || updateComment.isPending;

  // basic parser: splits by "# Category" and "Level N"
  function parseMarkdown(text: string) {
    const lines = text.split(/\r?\n/);
    const result: Record<string, Record<string, string>> = {};
    let currentCat = "";
    let currentLvl = "";
    for (const line of lines) {
      const cat = /^#\s*(.+)/.exec(line);
      if (cat) {
        currentCat = cat[1]!.toLowerCase().trim();
        result[currentCat] = {};
        currentLvl = "";
        continue;
      }
      const lvl = /^Level\s+(\d+)/i.exec(line);
      if (lvl && currentCat) {
        currentLvl = lvl[1]!;
        result[currentCat]![currentLvl] = "";
        continue;
      }
      if (currentCat && currentLvl) {
        result[currentCat]![currentLvl] += line + "\n";
      }
    }
    return result;
  }

  async function handleFile(file: File) {
    setIsProcessing(true);
    try {
      const text = await file.text();
      const json = parseMarkdown(text);

      // simple validation
      if (Object.keys(json).length === 0) {
        alert(
          "Failed to parse markdown. Please double check that you have at least one `# Heading`.",
        );
        return;
      }

      const comments = JSON.stringify(json);
      updateComment.mutate(
        { comments: comments, report_id: report.id },
        {
          onSuccess: () => {
            setOpen(false);
          },
        },
      );
    } finally {
      setIsProcessing(false);
    }
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files.length > 0 && !isLoading) {
      void handleFile(e.dataTransfer.files[0]!);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0] && !isLoading) {
      void handleFile(e.target.files[0]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload Subject Comments</DialogTitle>
          <DialogDescription>
            Drop your markdown template here or click to browse.{" "}
            <a
              className="underline"
              target="_blank"
              rel="noopener noreferrer"
              href="https://docs.google.com/document/d/1xXIa8AHNXQWyHHjBBiuycQ7uT5LQPWu3l9NMzGXtj-g/edit?usp=sharing"
            >
              Click here to see an example file.
            </a>{" "}
            The format must be the same, otherwise the upload will fail.
            Subjects must be Heading 1, levels must be Level x, and comments
            must be on different lines and start with &quot;- &quot;.
            <br />
            <br />
            Uploading will replace all comments you may have already uploaded
            for this report.
          </DialogDescription>
        </DialogHeader>
        <div
          role="presentation"
          tabIndex={0}
          className={`group border-muted-foreground/25 hover:bg-muted/25 focus-visible:ring-ring ring-offset-background relative grid h-80 w-full cursor-pointer place-items-center rounded-lg border-2 border-dashed px-5 py-2.5 text-center transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none ${
            isLoading ? "pointer-events-none opacity-50" : ""
          }`}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => !isLoading && fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".md,text/markdown"
            className="sr-only"
            onChange={handleChange}
            disabled={isLoading}
          />
          {isLoading ? (
            <div className="flex flex-col items-center justify-center gap-4 sm:px-5">
              <div className="border-muted-foreground rounded-full border border-dashed p-3">
                <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
              </div>
              <div className="flex flex-col gap-px">
                <p className="text-muted-foreground font-medium">
                  {isProcessing ? "Processing file..." : "Uploading..."}
                </p>
                <p className="text-muted-foreground/70 text-sm">
                  Please wait while we process your file.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-4 sm:px-5">
              <div className="border-muted-foreground rounded-full border border-dashed p-3">
                <Upload className="text-muted-foreground h-6 w-6" />
              </div>
              <div className="flex flex-col gap-px">
                <p className="text-muted-foreground font-medium">
                  Drag &apos;n&apos; drop your <i>Markdown (.md)</i> file here.
                </p>
                <p className="text-muted-foreground/70 text-sm">
                  Or click to browse for it.
                </p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
