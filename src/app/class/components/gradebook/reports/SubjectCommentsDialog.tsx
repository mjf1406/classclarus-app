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
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import type { Report } from "@/server/db/types";

interface SubjectCommentsDialogProps {
  classId: string;
  report: Report;
  trigger: React.ReactNode;
}

export default function SubjectCommentsDialog({
  classId,
  report,
  trigger,
}: SubjectCommentsDialogProps) {
  const [open, setOpen] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

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
    const text = await file.text();
    const json = parseMarkdown(text);
    console.log(json);
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files.length > 0) {
      void handleFile(e.dataTransfer.files[0] as unknown as File);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
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
          </DialogDescription>
        </DialogHeader>
        <div
          role="presentation"
          tabIndex={0}
          className="group border-muted-foreground/25 hover:bg-muted/25 focus-visible:ring-ring ring-offset-background relative grid h-80 w-full cursor-pointer place-items-center rounded-lg border-2 border-dashed px-5 py-2.5 text-center transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".md,text/markdown"
            className="sr-only"
            onChange={handleChange}
          />
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
