"use client";

import React, {
  useState,
  useCallback,
  useMemo,
  useEffect,
  useRef,
} from "react";
import GroupsSelect from "@/components/selects/GroupSelect";
import RandomizerNameInput from "../components/RandomizerNameInput";
import SelectionModeRadio from "../components/SelectionModeRadio";
import AutoRemoveCheckbox from "../components/AutoRemoveCheckbox";
import type {
  Group,
  StudentGroup,
  StudentSubGroup,
  SubGroup,
  StudentClassWithStudent,
} from "@/server/db/types";
import { Button } from "@/components/ui/button";
import {
  Shuffle,
  Dice1,
  Volume2,
  VolumeX,
  MonitorPlay,
  MonitorPause,
  MemoryStick,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useQuery } from "@tanstack/react-query";
import { ClassByIdOptions } from "@/app/api/queryOptions";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useCreateRandomization } from "../hooks/useCreateRandomization";
import { useCreateRandomizationStudent } from "../hooks/useCreateRandomizationStudent";
import { RandomizationManagerDialog } from "../components/RandomizationManagerDialog";

interface StudentTabProps {
  classId: string | null;
  _groups: Group[] | undefined;
  _subgroups: SubGroup[] | undefined;
  studentGroups: StudentGroup[] | undefined;
  studentSubGroups: StudentSubGroup[] | undefined;
}

interface SelectedStudent {
  student: StudentClassWithStudent;
  isSelected: boolean;
  isAnimating: boolean;
  currentDisplayName: string;
}

const SPIN_INTERVAL = 100; // ms between name‐changes while spinning
const REVEAL_INTERVAL = 1750; // ms between each final reveal
const AUDIO_DELAY = 1000;

const StudentTab: React.FC<StudentTabProps> = ({
  classId,
  _groups,
  _subgroups,
  studentGroups,
  studentSubGroups,
}) => {
  const [name, setName] = useState("");
  const [selectionMode, setSelectionMode] = useState<
    "all-at-once" | "one-by-one"
  >("all-at-once");
  const [autoRemove, setAutoRemove] = useState(false);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [selectedSubgroups, setSelectedSubgroups] = useState<string[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<SelectedStudent[]>(
    [],
  );
  const [isRandomizing, setIsRandomizing] = useState(false);
  const [currentSelectionIndex, setCurrentSelectionIndex] = useState(0);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [skipAnimation, setSkipAnimation] = useState(false);
  const [currentRandomizationId, setCurrentRandomizationId] = useState<
    string | null
  >(null);

  // refs for spin intervals, reveal timeouts, and sound timeouts
  const animIntervalRefs = useRef<(NodeJS.Timeout | null)[]>([]);
  const revealTimeoutRefs = useRef<(NodeJS.Timeout | null)[]>([]);
  const soundTimeoutRefs = useRef<(NodeJS.Timeout | null)[]>([]);

  // track which student_ids have been revealed
  const revealedIdsRef = useRef<Set<string>>(new Set());

  // track finalized students with their positions for saving
  const finalizedStudentsRef = useRef<
    { student_id: string; position: number }[]
  >([]);

  // preload sound
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize hooks
  const createRandomizationMutation = useCreateRandomization(classId ?? "");
  const createRandomizationStudentMutation = useCreateRandomizationStudent(
    classId ?? "",
    currentRandomizationId ?? "",
  );

  useEffect(() => {
    const url =
      "https://r051rsdjcy.ufs.sh/f/Mvjw3VCDi4AFeMYS0TPnmAvDiqzTPyjMlQxgB8E0FbUcSdrK";
    if (url) {
      audioRef.current = new Audio(url);
      audioRef.current.preload = "auto";
    }
  }, []);

  // cleanup on unmount
  useEffect(() => {
    return () => {
      animIntervalRefs.current.forEach((i) => i && clearInterval(i));
      revealTimeoutRefs.current.forEach((t) => t && clearTimeout(t));
      soundTimeoutRefs.current.forEach((t) => t && clearTimeout(t));
    };
  }, []);

  // clear everything when starting a new shuffle
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

  // Save students to randomization when all are finalized
  const saveRandomizationStudents = useCallback(
    async (
      studentsWithPositions: { student_id: string; position: number }[],
    ) => {
      if (!currentRandomizationId || !classId) return;

      try {
        for (const { student_id, position } of studentsWithPositions) {
          await createRandomizationStudentMutation.mutateAsync({
            student_id,
            position,
          });
        }
        toast.success(`Randomization "${name}" saved successfully!`);
      } catch (error) {
        console.error("Error saving randomization students:", error);
        toast.error("Failed to save randomization students");
      }
    },
    [currentRandomizationId, classId, createRandomizationStudentMutation, name],
  );

  // Check if all students are finalized and save if needed
  const checkAndSaveIfComplete = useCallback(() => {
    const allFinalized = selectedStudents.every((s) => !s.isAnimating);
    if (
      allFinalized &&
      !isRandomizing &&
      currentRandomizationId &&
      finalizedStudentsRef.current.length > 0
    ) {
      void saveRandomizationStudents(finalizedStudentsRef.current);
      finalizedStudentsRef.current = [];
    }
  }, [
    selectedStudents,
    isRandomizing,
    currentRandomizationId,
    saveRandomizationStudents,
  ]);

  // Watch for completion
  useEffect(() => {
    checkAndSaveIfComplete();
  }, [checkAndSaveIfComplete]);

  // fetch students
  const { data: classData } = useQuery(ClassByIdOptions(classId));
  const studentInfo = useMemo(
    () => classData?.studentInfo ?? [],
    [classData?.studentInfo],
  );

  const handleGroupsSelect = useCallback((g: string[]) => {
    setSelectedGroups(g);
  }, []);
  const handleSubgroupsSelect = useCallback((s: string[]) => {
    setSelectedSubgroups(s);
  }, []);

  const eligibleStudents = useMemo(() => {
    if (!studentInfo.length) return [];
    let arr = studentInfo;
    if (selectedGroups.length) {
      const inG = new Set(
        studentGroups
          ?.filter((sg) => selectedGroups.includes(sg.group_id))
          .map((sg) => sg.student_id) ?? [],
      );
      arr = arr.filter((s) => inG.has(s.student_id));
    }
    if (selectedSubgroups.length) {
      const inS = new Set(
        studentSubGroups
          ?.filter((ss) => selectedSubgroups.includes(ss.sub_group_id))
          .map((ss) => ss.student_id) ?? [],
      );
      arr = arr.filter((s) => inS.has(s.student_id));
    }
    return arr;
  }, [
    studentInfo,
    selectedGroups,
    selectedSubgroups,
    studentGroups,
    studentSubGroups,
  ]);

  const getRandomStudent = useCallback(
    (excludeRevealed = false) => {
      let pool = eligibleStudents;
      if (excludeRevealed) {
        pool = pool.filter((st) => !revealedIdsRef.current.has(st.student_id));
      }
      if (!pool.length) return null;
      return pool[Math.floor(Math.random() * pool.length)];
    },
    [eligibleStudents],
  );

  // core animation for a single slot
  const animateSelection = useCallback(
    (index: number) => {
      const exclude = selectionMode === "all-at-once" ? true : autoRemove;
      const revealTime = skipAnimation ? 100 : REVEAL_INTERVAL;
      const audioDelay = skipAnimation ? 50 : AUDIO_DELAY;

      // clear old timers for this slot
      if (animIntervalRefs.current[index]) {
        clearInterval(animIntervalRefs.current[index]);
      }
      if (revealTimeoutRefs.current[index]) {
        clearTimeout(revealTimeoutRefs.current[index]);
      }
      if (soundTimeoutRefs.current[index]) {
        clearTimeout(soundTimeoutRefs.current[index]);
      }

      // mark spinning
      setSelectedStudents((prev) =>
        prev.map((it, i) => (i === index ? { ...it, isAnimating: true } : it)),
      );

      // spin every SPIN_INTERVAL (only if not skipping animation)
      let spinId: NodeJS.Timeout | null = null;
      if (!skipAnimation) {
        spinId = setInterval(() => {
          const rnd = getRandomStudent(exclude);
          if (!rnd) return;
          setSelectedStudents((prev) =>
            prev.map((it, i) =>
              i === index
                ? {
                    ...it,
                    currentDisplayName: `${rnd.student_name_first_en} ${rnd.student_name_last_en}`,
                  }
                : it,
            ),
          );
        }, SPIN_INTERVAL);
        animIntervalRefs.current[index] = spinId;
      }

      // play sound before reveal
      const soundId = setTimeout(playSelectionSound, revealTime - audioDelay);
      soundTimeoutRefs.current[index] = soundId;

      // reveal after delay
      const doneId = setTimeout(() => {
        if (spinId) clearInterval(spinId);
        animIntervalRefs.current[index] = null;

        const finalStu = getRandomStudent(exclude);
        if (finalStu) {
          revealedIdsRef.current.add(finalStu.student_id);
          // Store student with position (index + 1 for 1-based positioning)
          finalizedStudentsRef.current.push({
            student_id: finalStu.student_id,
            position: index + 1,
          });

          setSelectedStudents((prev) =>
            prev.map((it, i) =>
              i === index
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

        if (selectionMode === "one-by-one") {
          setCurrentSelectionIndex((p) => p + 1);
        }
      }, revealTime);
      revealTimeoutRefs.current[index] = doneId;
    },
    [
      autoRemove,
      getRandomStudent,
      playSelectionSound,
      selectionMode,
      skipAnimation,
    ],
  );

  // start the shuffle/pick
  const handleRandomizeStudent = useCallback(async () => {
    // clear previous inline error
    setInlineError(null);

    if (!eligibleStudents.length) {
      const msg = "No students available for selection.";
      toast.error(msg);
      setInlineError(msg);
      return;
    }

    if (!classId) {
      toast.error("Class ID is required");
      return;
    }

    clearAllTimers();
    setIsRandomizing(true);
    setCurrentSelectionIndex(0);
    setCurrentRandomizationId(null);

    // Create randomization if name is provided
    let randomizationId: string | null = null;
    if (name.trim()) {
      try {
        // Get the highest position for this class to ensure unique positions
        randomizationId = await createRandomizationMutation.mutateAsync({
          class_id: classId,
          name: name.trim(),
        });
        setCurrentRandomizationId(randomizationId);
      } catch (error) {
        console.error("Error creating randomization:", error);
        toast.error("Failed to create randomization");
        setIsRandomizing(false);
        return;
      }
    }

    const placeholder = eligibleStudents[0]!;
    const revealTime = skipAnimation ? 100 : REVEAL_INTERVAL;
    const audioDelay = skipAnimation ? 50 : AUDIO_DELAY;

    if (selectionMode === "all-at-once") {
      const initial = eligibleStudents.map(() => ({
        student: placeholder,
        isSelected: false,
        isAnimating: true,
        currentDisplayName: `${placeholder.student_name_first_en} ${placeholder.student_name_last_en}`,
      }));
      setSelectedStudents(initial);

      initial.forEach((_, i) => {
        // spin (only if not skipping animation)
        let spinId: NodeJS.Timeout | null = null;
        if (!skipAnimation) {
          spinId = setInterval(() => {
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

        // play sound before this slot's reveal
        const currentRevealTime = (i + 1) * revealTime;
        const soundId = setTimeout(
          playSelectionSound,
          currentRevealTime - audioDelay,
        );
        soundTimeoutRefs.current[i] = soundId;

        // reveal at (i+1)*revealTime
        const revId = setTimeout(() => {
          if (spinId) clearInterval(spinId);
          animIntervalRefs.current[i] = null;

          const finalStu = getRandomStudent(true);
          if (finalStu) {
            revealedIdsRef.current.add(finalStu.student_id);
            // Store student with position (i + 1 for 1-based positioning)
            finalizedStudentsRef.current.push({
              student_id: finalStu.student_id,
              position: i + 1,
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
    } else {
      // one-by-one: up to 5 picks
      const count = Math.min(5, eligibleStudents.length);
      const initial = Array.from({ length: count }, () => ({
        student: placeholder,
        isSelected: false,
        isAnimating: false,
        currentDisplayName: `${placeholder.student_name_first_en} ${placeholder.student_name_last_en}`,
      }));
      setSelectedStudents(initial);
      setTimeout(() => animateSelection(0), 500);
    }
  }, [
    eligibleStudents,
    selectionMode,
    clearAllTimers,
    getRandomStudent,
    playSelectionSound,
    animateSelection,
    skipAnimation,
    classId,
    name,
    createRandomizationMutation,
  ]);

  // chain one-by-one
  useEffect(() => {
    if (
      selectionMode === "one-by-one" &&
      isRandomizing &&
      currentSelectionIndex > 0 &&
      currentSelectionIndex < selectedStudents.length
    ) {
      const delay = skipAnimation ? 200 : 1000;
      const t = setTimeout(
        () => animateSelection(currentSelectionIndex),
        delay,
      );
      return () => clearTimeout(t);
    } else if (
      currentSelectionIndex >= selectedStudents.length &&
      selectedStudents.length > 0
    ) {
      setIsRandomizing(false);
    }
  }, [
    currentSelectionIndex,
    selectedStudents.length,
    selectionMode,
    isRandomizing,
    animateSelection,
    skipAnimation,
  ]);

  const toggleStudentSelection = useCallback((studentId: string) => {
    setSelectedStudents((prev) =>
      prev.map((it) =>
        it.student.student_id === studentId
          ? { ...it, isSelected: !it.isSelected }
          : it,
      ),
    );
  }, []);

  const buttonText =
    selectionMode === "all-at-once"
      ? "Shuffle Students"
      : "Pick Random Student";
  const ButtonIcon = selectionMode === "all-at-once" ? Shuffle : Dice1;

  return (
    <div>
      <div className="space-y-6">
        <p>
          Randomly select students from the whole class or from certain
          group(s)/subgroup(s).
        </p>
        <RandomizerNameInput value={name} onChange={setName} />
        <SelectionModeRadio
          value={selectionMode}
          onValueChange={(value) =>
            setSelectionMode(value as "all-at-once" | "one-by-one")
          }
        />
        {selectionMode === "one-by-one" && (
          <AutoRemoveCheckbox
            entityType="students"
            checked={autoRemove}
            onCheckedChange={setAutoRemove}
          />
        )}
        <GroupsSelect
          classId={classId}
          selectedGroups={selectedGroups}
          onGroupsSelect={handleGroupsSelect}
          showSubgroups
          selectedSubgroups={selectedSubgroups}
          onSubgroupsSelect={handleSubgroupsSelect}
        />

        <div className="flex items-center gap-2">
          <Button
            size="lg"
            onClick={handleRandomizeStudent}
            disabled={isRandomizing}
          >
            <ButtonIcon />
            {isRandomizing ? "Randomizing..." : buttonText}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsMuted(!isMuted)}
            disabled={isRandomizing}
            className="h-10 w-10"
          >
            {isMuted ? <VolumeX /> : <Volume2 />}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSkipAnimation(!skipAnimation)}
            disabled={isRandomizing}
            className="h-10 w-10"
          >
            {skipAnimation ? <MonitorPause /> : <MonitorPlay />}
          </Button>
        </div>

        {inlineError && <p className="mt-2 text-red-600">{inlineError}</p>}

        {selectedStudents.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">
              {selectionMode === "all-at-once"
                ? "Shuffled Students"
                : "Picked Student"}
            </h3>
            <ol className="space-y-1">
              {selectedStudents.map((item, idx) => (
                <li
                  key={`${item.student.student_id}-${idx}`}
                  className={cn(
                    "flex w-fit items-center space-x-3 px-2 py-1 text-xl transition-all duration-200",
                    item.isAnimating && "text-secondary font-bold",
                  )}
                >
                  <span className="w-6 text-left">{idx + 1}</span>
                  <Checkbox
                    id={`student-${item.student.student_id}-${idx}`}
                    checked={item.isSelected}
                    onCheckedChange={() =>
                      toggleStudentSelection(item.student.student_id)
                    }
                    disabled={item.isAnimating}
                  />
                  <Label
                    htmlFor={`student-${item.student.student_id}-${idx}`}
                    className="flex-1 cursor-pointer"
                  >
                    {item.currentDisplayName}
                  </Label>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentTab;
