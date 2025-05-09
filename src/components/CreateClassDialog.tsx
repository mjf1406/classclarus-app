"use client";

import React, { Suspense, useState } from "react";
import { Plus, Info, ExternalLink, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@clerk/nextjs";
import insertClass, {
  type ClassGrade,
  type Data,
  type Role,
  type CSVStudent,
} from "@/app/class/actions/createClass";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import Image from "next/image";
import { useQueryClient } from "@tanstack/react-query";
import { TeacherClassesOptions } from "@/app/api/queryOptions";

export type TeacherClassRole = "primary" | "assistant";

export type TeacherClassDetail = {
  teacherAssignment: TeacherClass;
  classInfo: Class;
};

export interface Class {
  class_id: string;
  class_name: string;
  class_language: string;
  class_grade?: "1" | "2" | "3" | "4" | "5" | "6";
  class_year?: string;
  class_code: string;
  archived: boolean;
  complete: {
    s1: boolean;
    s2: boolean;
  };
  created_date: string;
  updated_date: string;
}

export interface TeacherClass {
  assignment_id: string;
  user_id: string;
  class_id: string;
  role?: TeacherClassRole;
  assigned_date: string;
}

export default function CreateClassDialog() {
  const router = useRouter();
  const { userId } = useAuth();
  const [activeTab, setActiveTab] = useState<
    "template-upload" | "google-classroom"
  >("template-upload");

  // Shared fields for CSV or Google Classroom
  const [className, setClassName] = useState("");
  const [classGrade, setClassGrade] = useState<ClassGrade>("1");
  const [classLanguage, setClassLanguage] = useState("en");
  const [classYear, setClassYear] = useState("");
  const [teacherRole, setTeacherRole] = useState("primary");

  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [isCsvValid, setCsvValid] = useState(false);
  const [loading, setLoading] = useState(false);

  // For Google Classroom import:
  const [showGoogleStudentTable, setShowGoogleStudentTable] = useState(false);
  const [selectedGoogleCourseId, setSelectedGoogleCourseId] = useState<
    string | undefined
  >(undefined);

  // Initialize React Query client
  const queryClient = useQueryClient();

  // -----------------------------
  // CSV VALIDATION & HELPERS
  // -----------------------------
  function csvToJson(csvString: string): CSVStudent[] {
    const lines = csvString.split("\n");
    const result: CSVStudent[] = [];
    const headers = lines[0]?.split(",") ?? [];

    for (let i = 1; i < lines.length; i++) {
      const obj: CSVStudent = {};
      const currentLine = lines[i]?.split(",") ?? [];

      if (
        headers.length > 0 &&
        currentLine &&
        currentLine.length === headers.length
      ) {
        for (let j = 0; j < headers.length; j++) {
          const header = headers[j]?.trim();
          if (header === undefined) continue;
          obj[header] = currentLine[j]?.trim() ?? "";
        }
        result.push(obj);
      }
    }
    return result;
  }

  const validateCsv = (file: File | null) => {
    if (!file) {
      console.error("Failed to create class:");
      toast.error("Failed to create the class!");
      throw new Error("Please upload a file");
    }
    setFile(file);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event?.target?.result as string;
      let data = csvToJson(text);
      console.log("🚀 @ data:", data);
      data = data.filter(
        (i) =>
          i.name_first_en !== "" && i.name_last_en !== "" && i.grade !== "",
      );
      let isValid = false;
      for (const student of data) {
        if (
          !student.number ||
          !student.sex ||
          !student.name_first_en ||
          !student.name_last_en ||
          !student.grade ||
          !student.reading_level ||
          student.number === null ||
          student.sex === null ||
          student.name_first_en === null ||
          student.name_last_en === null ||
          student.grade === null ||
          student.reading_level === null ||
          student.number === "" ||
          student.sex === "" ||
          student.name_first_en === "" ||
          student.name_last_en === "" ||
          student.grade === "" ||
          student.reading_level === ""
        ) {
          const errorMsg =
            "One (or more) of the required fields is (are) empty. The required fields are number, sex, and name_first_en.";
          console.error("Failed to create class:", errorMsg);
          toast.error("Invalid CSV!");
          isValid = false;
          setCsvValid(false);
          break;
        }
        isValid = true;
      }
      if (isValid) setCsvValid(true);
    };
    reader.readAsText(file);
  };

  // -----------------------------
  // CSV SUBMISSION LOGIC WITH QUERY INVALIDATION
  // -----------------------------
  const handleCreateClassCsv = async () => {
    if (isCsvValid === false) {
      const errorMsg =
        "Invalid CSV: One (or more) of the required fields is (are) empty. The required fields are number, sex, and name_first_en.";
      console.error("Failed to create class:", errorMsg);
      return toast.error("Failed to create class!");
    }
    if (!userId) {
      alert("User not authenticated.");
      return;
    }
    if (!file) {
      alert("Please select a file to upload.");
      return;
    }
    if (!className || className === "") {
      alert("Please input a class name");
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event?.target?.result;

      // Prepare the new class data.
      const newClass: Data = {
        class_id: "", // Let your backend generate the ID
        class_name: className,
        class_language: classLanguage,
        class_grade: classGrade,
        class_year: classYear,
        role: teacherRole as Role,
        // eslint-disable-next-line @typescript-eslint/no-base-to-string
        fileContents: String(text),
      };

      try {
        setLoading(true);
        await insertClass(newClass, false, "template");
        // Invalidate the teacher-classes query so that it refetches the latest data.
        await queryClient.invalidateQueries({
          queryKey: TeacherClassesOptions.queryKey,
        });
        setOpen(false);
        toast.success("Class created successfully!");
      } catch (error) {
        console.error("Failed to create class:", error);
        toast.error("Failed to create the class!");
      } finally {
        setLoading(false);
      }
    };
    reader.readAsText(file);
  };

  // -----------------------------
  // MAIN 'CREATE CLASS' HANDLER
  // -----------------------------
  const handleCreateClass = async () => {
    if (activeTab === "google-classroom") {
      // Google Classroom flow goes here.
      if (!selectedGoogleCourseId) {
        return toast.error("No Google Classroom selected!");
      }
      setShowGoogleStudentTable(true);
      return;
    }
    // Otherwise, handle CSV submission with query invalidation.
    await handleCreateClassCsv();
  };

  // Once user is done (or cancels) in the Google Classroom student table
  const handleGoogleTableClose = () => {
    setShowGoogleStudentTable(false);
    setOpen(false);
  };

  // -----------------------------
  // RENDER
  // -----------------------------
  return (
    <>
      {/* Uncomment or adjust the Google Classroom student table as needed */}
      {/* <GoogleClassroomStudentTableDialog
        open={showGoogleStudentTable}
        onClose={handleGoogleTableClose}
        selectedCourseId={selectedGoogleCourseId}
        classGrade={classGrade}
        classYear={classYear}
      /> */}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button className="text-foreground">
            <Plus /> <span className="hidden sm:block">Create class</span>
          </Button>
        </DialogTrigger>
        <DialogContent className="flex h-full flex-col p-6 sm:w-full sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Create a new class</DialogTitle>
            <DialogDescription>
              Create a new class to add to your class list.
            </DialogDescription>
          </DialogHeader>
          <Tabs
            defaultValue="template-upload"
            className="mt-4"
            onValueChange={(val) =>
              setActiveTab(val as "template-upload" | "google-classroom")
            }
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="template-upload" className="text-background">
                Upload via Template
              </TabsTrigger>
              <TabsTrigger value="google-classroom" className="text-background">
                Import from Google Classroom
              </TabsTrigger>
            </TabsList>
            <div className="mt-4 flex-1 overflow-auto">
              {/* TAB 1: CSV / Template Upload */}
              <TabsContent value="template-upload">
                <div className="flex flex-col space-y-4">
                  {/* Step 1 */}
                  <div className="flex flex-col items-start gap-2 space-x-2">
                    <h2 className="flex items-center gap-1 text-2xl">Step 1</h2>
                    <span className="no-wrap inline">
                      Make a copy of and fill out the{" "}
                      <Link
                        href="https://docs.google.com/spreadsheets/d/1mI61R0IS04-8ALMWC5_NLkKZVNkjJas2ylj5V7cb0D8/edit?usp=sharing"
                        rel="noopener noreferrer"
                        target="_blank"
                        className="inline underline"
                      >
                        Class Template{" "}
                        <ExternalLink className="ml-1 inline-block h-4 w-4" />
                      </Link>
                    </span>
                    <span className="text-xs font-normal">
                      The field <i>name_alt</i> is optional.
                    </span>
                  </div>
                  {/* Step 2 */}
                  <div className="flex flex-col items-start gap-2 space-x-2">
                    <h2 className="text-2xl">Step 2</h2>
                    <p>
                      <Label>
                        From Google Sheets, download the Class Template as{" "}
                        <b>Comma-separated values (.csv)</b>.
                      </Label>
                    </p>
                  </div>
                  {/* Step 3 */}
                  <div className="flex flex-col items-start gap-2 space-x-2">
                    <h2 className="text-2xl">Step 3</h2>
                    <div className="grid w-full max-w-sm items-center gap-1.5">
                      <Label htmlFor="class-template-upload">
                        Upload the Class Template
                      </Label>
                      <Input
                        id="class-template-upload"
                        type="file"
                        accept=".csv"
                        onChange={(e) => {
                          const selectedFile =
                            e.target.files && e.target.files.length > 0
                              ? e.target.files[0]
                              : null;
                          validateCsv(selectedFile ?? null);
                        }}
                      />
                    </div>
                  </div>
                  {/* Step 4 */}
                  <div className="flex flex-col items-start gap-2 space-x-2">
                    <h2 className="text-2xl">Step 4</h2>
                    <div className="space-y-2">
                      <div className="grid flex-1 gap-2">
                        <Label
                          htmlFor="class-name"
                          className="flex items-center"
                        >
                          Class name{" "}
                          <span className="pl-2">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Info width={16} />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>
                                    This is the display name of your class that
                                    you and your students will see.
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </span>
                        </Label>
                        <Input
                          id="class-name"
                          placeholder="Enter class name"
                          value={className}
                          onChange={(e) => setClassName(e.target.value)}
                        />
                      </div>
                      <div className="grid flex-1 gap-2">
                        <Label
                          htmlFor="class-grade"
                          className="flex items-center"
                        >
                          Class grade{" "}
                          <span className="pl-2">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Info width={16} />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>
                                    This is used to determine which students are
                                    behind in reading.
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </span>
                        </Label>
                        <Select
                          onValueChange={(value) =>
                            setClassGrade(value as ClassGrade)
                          }
                        >
                          <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Class grade" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">1</SelectItem>
                            <SelectItem value="2">2</SelectItem>
                            <SelectItem value="3">3</SelectItem>
                            <SelectItem value="4">4</SelectItem>
                            <SelectItem value="5">5</SelectItem>
                            <SelectItem value="6">6</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid flex-1 gap-2">
                        <Label
                          htmlFor="class-year"
                          className="flex items-center"
                        >
                          Class year{" "}
                          <span className="pl-2">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Info width={16} />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>
                                    You might have the same class in multiple
                                    years, right? 😉
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </span>
                        </Label>
                        <Input
                          id="class-year"
                          placeholder="Enter class year"
                          value={classYear}
                          onChange={(e) => setClassYear(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* TAB 2: Google Classroom */}
              <TabsContent value="google-classroom">
                <div className="flex items-center justify-center">
                  <Image
                    src="/img/under-construction.webp"
                    alt="Under Construction"
                    width={500}
                    height={500}
                    priority
                  />
                </div>
                {/* Additional Google Classroom integration can be implemented here */}
              </TabsContent>
            </div>
          </Tabs>
          <DialogFooter className="mt-6 flex justify-end">
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                Cancel
              </Button>
            </DialogClose>
            <Button
              type="submit"
              onClick={handleCreateClass}
              disabled={loading}
              className="ml-auto"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create class"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
