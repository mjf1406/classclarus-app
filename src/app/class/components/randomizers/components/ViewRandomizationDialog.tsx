import React, {
  type ReactNode,
  useCallback,
  useState,
  useRef,
  useEffect,
  useMemo,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { v4 as uuidV4 } from "uuid"; // Add this import
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { ClassByIdOptions } from "@/app/api/queryOptions";
import { useUpdateRandomizationStudent } from "../hooks/useUpdateRandomizationStudent";
import { useCreateRandomization } from "../hooks/useCreateRandomization";
import { useCreateRandomizationStudent } from "../hooks/useCreateRandomizationStudent";
import type { RandomizationWithStudents } from "@/server/db/schema";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type {
  StudentClassWithStudent,
  StudentGroup,
  StudentSubGroup,
} from "@/server/db/types";

interface SelectedStudent {
  student: StudentClassWithStudent;
  isSelected: boolean;
  isAnimating: boolean;
  currentDisplayName: string;
}

interface RandomizationParams {
  name: string;
  selectionMode: "all-at-once" | "one-by-one";
  autoRemove: boolean;
  selectedGroups: string[];
  selectedSubgroups: string[];
  eligibleStudents: StudentClassWithStudent[];
  studentGroups?: StudentGroup[];
  studentSubGroups?: StudentSubGroup[];
  isMuted?: boolean;
  skipAnimation?: boolean;
}

interface ViewRandomizationDialogProps {
  trigger: ReactNode;
  classId: string;
  mode: "view" | "randomize";
  randomization?: RandomizationWithStudents;
  randomizationParams?: RandomizationParams;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const SPIN_INTERVAL = 100;
const REVEAL_INTERVAL = 1750;
const AUDIO_DELAY = 1000;

export function ViewRandomizationDialog({
  trigger,
  classId,
  mode,
  randomization,
  randomizationParams,
  open,
  onOpenChange,
}: ViewRandomizationDialogProps) {
  const { data: classData } = useQuery(ClassByIdOptions(classId));
  const studentInfo = classData?.studentInfo ?? [];
  const isMuted = randomizationParams?.isMuted ?? false;
  const skipAnimation = randomizationParams?.skipAnimation ?? false;

  const { mutate: updateStudent } = useUpdateRandomizationStudent(classId);
  const createRandomizationMutation = useCreateRandomization(classId);
  // Initialize with empty string - we'll pass the randomization_id in the mutation call
  const createRandomizationStudentMutation =
    useCreateRandomizationStudent(classId);

  // Randomization state
  const [selectedStudents, setSelectedStudents] = useState<SelectedStudent[]>(
    [],
  );
  const [isRandomizing, setIsRandomizing] = useState(false);
  const [currentSelectionIndex, setCurrentSelectionIndex] = useState(0);
  const [currentRandomizationId, setCurrentRandomizationId] = useState<
    string | null
  >(null);

  // Animation refs
  const animIntervalRefs = useRef<(NodeJS.Timeout | null)[]>([]);
  const revealTimeoutRefs = useRef<(NodeJS.Timeout | null)[]>([]);
  const soundTimeoutRefs = useRef<(NodeJS.Timeout | null)[]>([]);
  const revealedIdsRef = useRef<Set<string>>(new Set());
  const finalizedStudentsRef = useRef<
    { student_id: string; position: number }[]
  >([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize audio
  useEffect(() => {
    const url =
      "https://r051rsdjcy.ufs.sh/f/Mvjw3VCDi4AFeMYS0TPnmAvDiqzTPyjMlQxgB8E0FbUcSdrK";
    if (url) {
      audioRef.current = new Audio(url);
      audioRef.current.preload = "auto";
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      animIntervalRefs.current.forEach((i) => i && clearInterval(i));
      revealTimeoutRefs.current.forEach((t) => t && clearTimeout(t));
      soundTimeoutRefs.current.forEach((t) => t && clearTimeout(t));
    };
  }, []);

  // Clear timers
  const clearAllTimers = useCallback(() => {
    animIntervalRefs.current.forEach((i) => i && clearInterval(i));
    animIntervalRefs.current = [];
    revealTimeoutRefs.current.forEach((t) => t && clearTimeout(t));
    revealTimeoutRefs.current = [];
    soundTimeoutRefs.current.forEach((t) => t && clearTimeout(t));
    soundTimeoutRefs.current = [];
    revealedIdsRef.current.clear();
    finalizedStudentsRef.current = [];
  }, []);

  const playSelectionSound = useCallback(() => {
    if (audioRef.current && !isMuted) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(console.error);
    }
  }, [isMuted]);

  const getRandomStudent = useCallback(
    (excludeRevealed = false, position?: number, totalPositions?: number) => {
      if (!randomizationParams?.eligibleStudents) return null;
      let pool = randomizationParams.eligibleStudents;
      if (excludeRevealed) {
        pool = pool.filter((st) => !revealedIdsRef.current.has(st.student_id));
      }
      if (!pool.length) return null;

      // If no position info provided, return random student (fallback behavior)
      if (position === undefined || totalPositions === undefined) {
        return pool[Math.floor(Math.random() * pool.length)];
      }

      // Position-based selection logic
      if (position === 1) {
        // First position: prioritize students with lowest first_count
        const minFirstCount = Math.min(...pool.map((s) => s.first_count));
        const candidates = pool.filter((s) => s.first_count === minFirstCount);
        return candidates[Math.floor(Math.random() * candidates.length)];
      } else if (position === totalPositions) {
        // Last position: prioritize students with lowest last_count
        const minLastCount = Math.min(...pool.map((s) => s.last_count));
        const candidates = pool.filter((s) => s.last_count === minLastCount);
        return candidates[Math.floor(Math.random() * candidates.length)];
      } else {
        // Middle positions: completely random
        return pool[Math.floor(Math.random() * pool.length)];
      }
    },
    [randomizationParams?.eligibleStudents],
  );

  // Save randomization students
  const saveRandomizationStudents = useCallback(
    async (
      studentsWithPositions: { student_id: string; position: number }[],
      retryCount = 0,
    ) => {
      if (!currentRandomizationId || !classId) return;

      try {
        for (const { student_id, position } of studentsWithPositions) {
          await createRandomizationStudentMutation.mutateAsync({
            randomization_id: currentRandomizationId,
            student_id,
            position,
          });
        }
        toast.success(
          `Randomization "${randomizationParams?.name}" saved successfully!`,
        );
      } catch (error) {
        console.error("Error saving randomization students:", error);

        // Retry once after a delay if it's the first attempt
        if (retryCount === 0) {
          console.log("Retrying save operation...");
          await new Promise((resolve) => setTimeout(resolve, 500));
          return saveRandomizationStudents(studentsWithPositions, 1);
        }

        toast.error("Failed to save randomization students");
      }
    },
    [
      currentRandomizationId,
      classId,
      createRandomizationStudentMutation,
      randomizationParams?.name,
    ],
  );

  // Start randomization when dialog opens in randomize mode
  useEffect(() => {
    if (
      mode === "randomize" &&
      open &&
      randomizationParams &&
      !isRandomizing &&
      !selectedStudents.length
    ) {
      const startRandomization = async () => {
        clearAllTimers();
        setIsRandomizing(true);
        setCurrentSelectionIndex(0);
        setCurrentRandomizationId(null);

        // Create randomization if name is provided
        let randomizationId: string | null = null;
        if (randomizationParams.name.trim()) {
          try {
            const generatedId = uuidV4();
            randomizationId = await createRandomizationMutation.mutateAsync({
              class_id: classId,
              name: randomizationParams.name.trim(),
              id: generatedId,
            });
            setCurrentRandomizationId(randomizationId);

            // Add a small delay to ensure the randomization is persisted
            await new Promise((resolve) => setTimeout(resolve, 100));
          } catch (error) {
            console.error("Error creating randomization:", error);
            toast.error("Failed to create randomization");
            setIsRandomizing(false);
            return;
          }
        }

        const placeholder = randomizationParams.eligibleStudents[0]!;
        const revealTime = skipAnimation ? 100 : REVEAL_INTERVAL;

        if (randomizationParams.selectionMode === "all-at-once") {
          const initial = randomizationParams.eligibleStudents.map(() => ({
            student: placeholder,
            isSelected: false,
            isAnimating: true,
            currentDisplayName: `${placeholder.student_name_first_en} ${placeholder.student_name_last_en}`,
          }));
          setSelectedStudents(initial);

          initial.forEach((_, i) => {
            const position = i + 1;
            const totalPositions = initial.length;

            // Animation logic for all-at-once mode
            let spinId: NodeJS.Timeout | null = null;
            if (!skipAnimation) {
              spinId = setInterval(() => {
                // During animation, show random students (no position logic needed)
                const rnd = getRandomStudent(true);
                if (!rnd) return;
                setSelectedStudents((prev) =>
                  prev.map((it, idx) =>
                    idx === i
                      ? {
                          ...it,
                          currentDisplayName: `${rnd.student_name_first_en} ${rnd.student_name_last_en}`,
                        }
                      : it,
                  ),
                );
              }, SPIN_INTERVAL);
              animIntervalRefs.current[i] = spinId;
            }

            const currentRevealTime = (i + 1) * revealTime;
            const soundId = setTimeout(
              playSelectionSound,
              currentRevealTime - AUDIO_DELAY,
            );
            soundTimeoutRefs.current[i] = soundId;

            const revId = setTimeout(() => {
              if (spinId) clearInterval(spinId);
              animIntervalRefs.current[i] = null;

              // Use position-aware selection for final reveal
              const finalStu = getRandomStudent(true, position, totalPositions);
              if (finalStu) {
                revealedIdsRef.current.add(finalStu.student_id);
                finalizedStudentsRef.current.push({
                  student_id: finalStu.student_id,
                  position: position,
                });

                setSelectedStudents((prev) =>
                  prev.map((it, idx) =>
                    idx === i
                      ? {
                          student: finalStu,
                          isSelected: false,
                          isAnimating: false,
                          currentDisplayName: `${finalStu.student_name_first_en} ${finalStu.student_name_last_en}`,
                        }
                      : it,
                  ),
                );
              }
              if (i === initial.length - 1) {
                setIsRandomizing(false);
              }
            }, currentRevealTime);
            revealTimeoutRefs.current[i] = revId;
          });
        }
      };

      void startRandomization();
    }
  }, [
    mode,
    open,
    randomizationParams,
    isRandomizing,
    selectedStudents.length,
    clearAllTimers,
    createRandomizationMutation,
    classId,
    skipAnimation,
    getRandomStudent,
    playSelectionSound,
  ]);

  // Save when all animations complete
  useEffect(() => {
    const allFinalized = selectedStudents.every((s) => !s.isAnimating);
    if (
      mode === "randomize" &&
      allFinalized &&
      !isRandomizing &&
      currentRandomizationId &&
      finalizedStudentsRef.current.length > 0
    ) {
      void saveRandomizationStudents(finalizedStudentsRef.current);
      finalizedStudentsRef.current = [];
    }
  }, [
    mode,
    selectedStudents,
    isRandomizing,
    currentRandomizationId,
    saveRandomizationStudents,
  ]);

  // Reset when dialog closes
  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      onOpenChange?.(newOpen);
      if (!newOpen && mode === "randomize") {
        // Reset state when closing
        clearAllTimers();
        setSelectedStudents([]);
        setIsRandomizing(false);
        setCurrentSelectionIndex(0);
        setCurrentRandomizationId(null);
      }
    },
    [onOpenChange, mode, clearAllTimers],
  );

  const handleToggleCheck = useCallback(
    (studentRandomizationId: string, studentId: string, checked: boolean) => {
      if (mode === "view") {
        updateStudent({
          id: studentRandomizationId,
          student_id: studentId,
          checked,
        });
      } else {
        // For randomize mode, just toggle local state
        setSelectedStudents((prev) =>
          prev.map((it) =>
            it.student.student_id === studentId
              ? { ...it, isSelected: checked }
              : it,
          ),
        );
      }
    },
    [mode, updateStudent],
  );

  // Prepare data based on mode
  const displayData = useMemo(() => {
    if (mode === "view" && randomization) {
      const sorted = [...randomization.students].sort(
        (a, b) => a.position - b.position,
      );
      return {
        title: randomization.name,
        students: sorted.map((s) => ({
          id: s.id,
          position: s.position,
          checked: s.checked,
          student_id: s.student_id,
          studentDetail: studentInfo.find(
            (si) => si.student_id === s.student_id,
          ),
          isAnimating: false,
          currentDisplayName: (() => {
            const detail = studentInfo.find(
              (si) => si.student_id === s.student_id,
            );
            return detail
              ? `${detail.student_name_first_en} ${detail.student_name_last_en}`
              : "Unknown Student";
          })(),
        })),
        showProgress: true,
        showMeta: true,
      };
    } else if (mode === "randomize") {
      return {
        title: randomizationParams?.name ?? "New Randomization",
        students: selectedStudents.map((s, idx) => ({
          id: `temp-${idx}`,
          position: idx + 1,
          checked: s.isSelected,
          student_id: s.student.student_id,
          studentDetail: s.student,
          isAnimating: s.isAnimating,
          currentDisplayName: s.currentDisplayName,
        })),
        showProgress: false,
        showMeta: false,
      };
    }
    return { title: "", students: [], showProgress: false, showMeta: false };
  }, [mode, randomization, randomizationParams, selectedStudents, studentInfo]);

  const total = displayData.students.length;
  const completed = displayData.students.filter((s) => s.checked).length;
  const progressValue = total > 0 ? (completed / total) * 100 : 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="h-full max-h-[calc(100dvh)] w-full min-w-[calc(100dvw)] content-start overflow-auto p-6">
        <DialogHeader className="flex items-center justify-between pb-4">
          <div>
            <DialogTitle className="text-5xl font-bold">
              {displayData.title}
            </DialogTitle>
            {displayData.showMeta && randomization && (
              <DialogDescription
                asChild
                className="text-muted-foreground mt-2 text-center text-2xl"
              >
                <div className="flex flex-col gap-4">
                  <div className="text-muted-foreground flex w-full flex-col items-center justify-center text-center text-sm">
                    <span>Created: {randomization.created_date}</span>
                    <span>Updated: {randomization.updated_date}</span>
                  </div>
                </div>
              </DialogDescription>
            )}
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1">
          {displayData.showProgress && (
            <div className="mb-10 flex w-full flex-col items-center justify-center">
              <span className="w-full text-center text-2xl font-semibold">
                {completed} of {total} completed
              </span>
              <Progress value={progressValue} className="mt-2 h-4 w-full" />
            </div>
          )}

          {displayData.students.length > 0 && (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {displayData.students.map((student) => (
                <Card
                  key={student.id}
                  className={cn(
                    "transition-all duration-200",
                    student.checked && mode === "view"
                      ? "opacity-50"
                      : "shadow-sm hover:shadow-md",
                  )}
                >
                  <CardContent>
                    <div className="flex items-center space-x-4">
                      <span className="bg-secondary inline-flex h-12 w-12 items-center justify-center rounded-full text-xl font-bold">
                        {student.position}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center space-x-3">
                          <Checkbox
                            id={`student-${student.id}`}
                            checked={student.checked}
                            onCheckedChange={(c) =>
                              handleToggleCheck(
                                student.id,
                                student.student_id,
                                Boolean(c),
                              )
                            }
                            className="h-6 w-6"
                            disabled={student.isAnimating}
                          />
                          <Label
                            htmlFor={`student-${student.id}`}
                            className={cn(
                              "cursor-pointer text-2xl font-semibold",
                              student.isAnimating &&
                                "text-primary animate-pulse font-bold",
                            )}
                          >
                            {student.currentDisplayName}
                          </Label>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {mode === "randomize" &&
            isRandomizing &&
            displayData.students.length === 0 && (
              <div className="flex items-center justify-center py-20">
                <div className="text-center">
                  <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full"></div>
                  <p className="text-lg">Preparing randomization...</p>
                </div>
              </div>
            )}
        </ScrollArea>

        <DialogFooter>
          <DialogClose asChild>
            <Button>Close</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
