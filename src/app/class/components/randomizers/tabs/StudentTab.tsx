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
import { Shuffle, Dice1 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useQuery } from "@tanstack/react-query";
import { ClassByIdOptions } from "@/app/api/queryOptions";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

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

  // refs for spin intervals, reveal timeouts, and sound timeouts
  const animIntervalRefs = useRef<(NodeJS.Timeout | null)[]>([]);
  const revealTimeoutRefs = useRef<(NodeJS.Timeout | null)[]>([]);
  const soundTimeoutRefs = useRef<(NodeJS.Timeout | null)[]>([]);

  // track which student_ids have been revealed
  const revealedIdsRef = useRef<Set<string>>(new Set());

  // preload sound
  const audioRef = useRef<HTMLAudioElement | null>(null);
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
  }, []);

  const playSelectionSound = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(console.error);
    }
  }, []);

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

      // spin every SPIN_INTERVAL
      const spinId = setInterval(() => {
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

      // play sound 500 ms before reveal
      const soundId = setTimeout(
        playSelectionSound,
        REVEAL_INTERVAL - AUDIO_DELAY,
      );
      soundTimeoutRefs.current[index] = soundId;

      // reveal after REVEAL_INTERVAL
      const doneId = setTimeout(() => {
        clearInterval(spinId);
        animIntervalRefs.current[index] = null;

        const finalStu = getRandomStudent(exclude);
        if (finalStu) {
          revealedIdsRef.current.add(finalStu.student_id);
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
      }, REVEAL_INTERVAL);
      revealTimeoutRefs.current[index] = doneId;
    },
    [autoRemove, getRandomStudent, playSelectionSound, selectionMode],
  );

  // start the shuffle/pick
  const handleRandomizeStudent = useCallback(() => {
    // clear previous inline error
    setInlineError(null);

    if (!eligibleStudents.length) {
      const msg = "No students available for selection.";
      toast.error(msg);
      setInlineError(msg);
      return;
    }
    clearAllTimers();
    setIsRandomizing(true);
    setCurrentSelectionIndex(0);

    const placeholder = eligibleStudents[0]!;

    if (selectionMode === "all-at-once") {
      const initial = eligibleStudents.map(() => ({
        student: placeholder,
        isSelected: false,
        isAnimating: true,
        currentDisplayName: `${placeholder.student_name_first_en} ${placeholder.student_name_last_en}`,
      }));
      setSelectedStudents(initial);

      initial.forEach((_, i) => {
        // spin
        const spinId = setInterval(() => {
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

        // play sound 500 ms before this slot’s reveal
        const revealTime = (i + 1) * REVEAL_INTERVAL;
        const soundId = setTimeout(
          playSelectionSound,
          revealTime - AUDIO_DELAY,
        );
        soundTimeoutRefs.current[i] = soundId;

        // reveal at (i+1)*REVEAL_INTERVAL
        const revId = setTimeout(() => {
          clearInterval(spinId);
          animIntervalRefs.current[i] = null;

          const finalStu = getRandomStudent(true);
          if (finalStu) {
            revealedIdsRef.current.add(finalStu.student_id);
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
        }, revealTime);
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
  ]);

  // chain one-by-one
  useEffect(() => {
    if (
      selectionMode === "one-by-one" &&
      isRandomizing &&
      currentSelectionIndex > 0 &&
      currentSelectionIndex < selectedStudents.length
    ) {
      const t = setTimeout(() => animateSelection(currentSelectionIndex), 1000);
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

      <Button
        size="lg"
        onClick={handleRandomizeStudent}
        disabled={isRandomizing}
      >
        <ButtonIcon />
        {isRandomizing ? "Randomizing..." : buttonText}
      </Button>

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
                  item.isAnimating && "font-bold text-yellow-700",
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
  );
};

export default StudentTab;
