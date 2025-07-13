// src/app/class/components/reports/century-skills/CenturySkillsModal.tsx
"use client";

import React, {
  useState,
  useMemo,
  useEffect,
  useCallback,
  startTransition,
  Suspense,
} from "react";
import dynamic from "next/dynamic";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { ArrowUp, ArrowDown, ChevronUp, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

import type { StudentClassWithStudent } from "@/server/db/types";
import type { CenturySkill, CenturySkillAchievement } from "@/server/db/schema";
import { useUpdateCenturySkill } from "./hooks/useUpdateCenturySkill";
import type { UpdateCenturySkillArgs } from "./actions/updateCenturySkill";

const VirtualizedCenturyTable = dynamic(
  () => import("./VirtualizedCenturyTable"),
  { ssr: false },
);

type SortKey = "student_number" | "first_name" | "last_name";

interface CenturySkillsModalProps {
  reportId: string;
  classId: string;
  trigger: React.ReactNode;
  centurySkills: CenturySkill[];
  students: StudentClassWithStudent[];
}

const FIELDS = [
  "responsibility",
  "organization",
  "collaboration",
  "communication",
  "thinking",
  "inquiry",
  "risk_taking",
  "open_minded",
] as const;

const ACHIEVEMENTS: { value: CenturySkillAchievement; label: string }[] = [
  { value: "AB", label: "AB" },
  { value: "CD", label: "CD" },
  { value: "P", label: "P" },
  { value: "NY", label: "NY" },
];

const DESCRIPTIONS: {
  key: string;
  title: string;
  items: string[];
}[] = [
  {
    key: "responsibility",
    title: "Responsibility",
    items: [
      "Completes and submits class work, homework, and assignments on time",
      "Takes responsibility for and manages own behaviour",
      "Follows instructions with minimal supervision",
    ],
  },
  {
    key: "organization",
    title: "Organization",
    items: [
      "Follows a plan and process",
      "Establishes priorities and manages independent time appropriately to complete tasks",
    ],
  },
  {
    key: "collaboration",
    title: "Collaboration",
    items: [
      "Accepts various roles in a group",
      "Works with others to achieve a common goal",
    ],
  },
  {
    key: "communication",
    title: "Communication",
    items: [
      "Expresses thoughts, ideas, and emotions using oral, written, ICT and nonverbal communication skills",
      "Listens effectively to comprehend meaning in a variety of forms and contexts",
    ],
  },
  {
    key: "thinking",
    title: "Thinking (Creative and Problem Solving)",
    items: [
      "Looks for and acts on new ideas and opportunities for learning",
      "Builds logical connections between ideas and uses information and knowledge to achieve a solution",
    ],
  },
  {
    key: "inquiry",
    title: "Inquiry",
    items: [
      "Demonstrates curiosity and interest in learning",
      "Generates questions for further inquiry",
      "Investigates and obtains information independently",
    ],
  },
  {
    key: "risk_taking",
    title: "Risk-Taking",
    items: [
      "Takes educated risks and makes an effort when responding to challenges",
      "Sees failure as an opportunity to learn and grow",
    ],
  },
  {
    key: "open_minded",
    title: "Open-Minded",
    items: [
      "Open to perspectives, values and traditions of others",
      "Familiar with seeking and evaluating a range of points of view",
    ],
  },
];

export default function CenturySkillsModal({
  reportId,
  classId,
  trigger,
  centurySkills = [],
  students = [],
}: CenturySkillsModalProps) {
  const updateCenturySkill = useUpdateCenturySkill(classId);
  const [isUpdating, setIsUpdating] = useState<Set<string>>(new Set());
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [sectionsOpen, setSectionsOpen] = useState(false);

  // 1) Build default payload map
  const defaultMap = useMemo(() => {
    const lookup = centurySkills.reduce<Record<string, CenturySkill>>(
      (acc, s) => {
        acc[s.student_id] = s;
        return acc;
      },
      {},
    );
    return students.reduce<Record<string, UpdateCenturySkillArgs>>(
      (acc, stu) => {
        const ex = lookup[stu.student_id];
        acc[stu.student_id] = {
          id: ex?.id,
          report_id: reportId,
          student_id: stu.student_id,
          responsibility: ex?.responsibility ?? "CD",
          organization: ex?.organization ?? "CD",
          collaboration: ex?.collaboration ?? "CD",
          communication: ex?.communication ?? "CD",
          thinking: ex?.thinking ?? "CD",
          inquiry: ex?.inquiry ?? "CD",
          risk_taking: ex?.risk_taking ?? "CD",
          open_minded: ex?.open_minded ?? "CD",
        };
        return acc;
      },
      {},
    );
  }, [centurySkills, students, reportId]);

  // 2) Sync state map
  const [skillMap, setSkillMap] = useState(defaultMap);
  useEffect(() => {
    setSkillMap(defaultMap);
  }, [defaultMap]);

  // 3) Sorting
  const [sortKey, setSortKey] = useState<SortKey>("student_number");
  const [asc, setAsc] = useState(true);
  const onSort = useCallback(
    (key: SortKey) => {
      if (key === sortKey) setAsc((p) => !p);
      else {
        setSortKey(key);
        setAsc(true);
      }
    },
    [sortKey],
  );

  // 4) Handle updates
  const onValueChange = (
    student_id: string,
    key: (typeof FIELDS)[number],
    v: CenturySkillAchievement,
  ) => {
    const updateKey = `${student_id}-${key}`;
    if (isUpdating.has(updateKey)) return;

    const row = skillMap[student_id]!;
    const updated: UpdateCenturySkillArgs = { ...row, [key]: v };

    setSkillMap((prev) => ({
      ...prev,
      [student_id]: updated,
    }));

    startTransition(() => {
      setIsUpdating((prev) => {
        const next = new Set(prev);
        next.add(updateKey);
        return next;
      });
      updateCenturySkill.mutate(updated, {
        onSettled: () => {
          setIsUpdating((prev) => {
            const next = new Set(prev);
            next.delete(updateKey);
            return next;
          });
        },
      });
    });
  };

  // Sorted list
  const sorted = useMemo(() => {
    return [...students].sort((a, b) => {
      let va: string | number = "",
        vb: string | number = "";
      switch (sortKey) {
        case "student_number":
          va = a.student_number ?? 0;
          vb = b.student_number ?? 0;
          break;
        case "first_name":
          va = a.student_name_first_en;
          vb = b.student_name_first_en;
          break;
        case "last_name":
          va = a.student_name_last_en;
          vb = b.student_name_last_en;
          break;
      }
      if (va < vb) return asc ? -1 : 1;
      if (va > vb) return asc ? 1 : -1;
      return 0;
    });
  }, [students, sortKey, asc]);

  // Pagination
  const ROWS_PER_PAGE = 7;
  const [page, setPage] = useState(0);
  const pageCount = Math.ceil(sorted.length / ROWS_PER_PAGE);
  const pagedStudents = useMemo(
    () =>
      sorted.slice(page * ROWS_PER_PAGE, page * ROWS_PER_PAGE + ROWS_PER_PAGE),
    [sorted, page],
  );

  const SortIcon = ({ field }: { field: SortKey }) =>
    sortKey === field ? (
      asc ? (
        <ArrowUp size={14} className="ml-1 inline-block" />
      ) : (
        <ArrowDown size={14} className="ml-1 inline-block" />
      )
    ) : null;

  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="h-full max-h-[calc(100dvh)] w-full min-w-[calc(100dvw)] content-start overflow-auto p-6">
        <DialogHeader>
          <DialogTitle>Century Skills Assessment</DialogTitle>
          <DialogClose className="absolute top-4 right-4" />
        </DialogHeader>

        <div className="mt-4 space-y-4">
          {/* Keyboard Shortcuts Collapsible */}
          <Collapsible open={shortcutsOpen} onOpenChange={setShortcutsOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm">
                <span>Keyboard Shortcuts</span>
                <ChevronUp
                  className={cn(
                    "h-4 w-4 transition-transform duration-200",
                    shortcutsOpen ? "rotate-180" : "rotate-0",
                  )}
                />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 mb-5 space-y-2 rounded-md bg-gray-50 p-4 text-sm dark:bg-gray-800">
              <ul className="list-disc space-y-1 pl-5">
                <li>Tab into a skill cell to focus its tab list.</li>
                <li>
                  Press <kbd>A</kbd> for <strong>AB</strong>, <kbd>C</kbd> for{" "}
                  <strong>CD</strong>, <kbd>P</kbd> for <strong>P</strong>, or{" "}
                  <kbd>N</kbd> for <strong>NY</strong>.
                </li>
              </ul>
            </CollapsibleContent>
          </Collapsible>

          {/* Instructions Collapsible */}
          <Collapsible open={sectionsOpen} onOpenChange={setSectionsOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm">
                <span>Instructions</span>
                <ChevronUp
                  className={cn(
                    "h-4 w-4 transition-transform duration-200",
                    sectionsOpen ? "rotate-180" : "rotate-0",
                  )}
                />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 mb-5 space-y-4 rounded-md bg-gray-50 p-4 text-sm dark:bg-gray-800">
              <div>
                Assess each student&apos;s 21st Century Skills.
                <br />
                <strong>AB</strong> = Absent,&nbsp;
                <strong>CD</strong> = Consistently Demonstrates,&nbsp;
                <strong>P</strong> = Progressing,&nbsp;<strong>NY</strong> = Not
                Yet
              </div>
              {DESCRIPTIONS.map(({ key, title, items }) => (
                <div key={key}>
                  <h4 className="font-semibold">{title}</h4>
                  <ul className="ml-4 list-disc space-y-1">
                    {items.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>

          {/* Table */}
          <Suspense
            fallback={
              <div className="flex h-full w-full items-center justify-center">
                <Loader2 className="h-24 w-24 animate-spin" />
              </div>
            }
          >
            <VirtualizedCenturyTable
              students={pagedStudents}
              skillMap={skillMap}
              FIELDS={FIELDS}
              ACHIEVEMENTS={ACHIEVEMENTS}
              sortKey={sortKey}
              asc={asc}
              onSort={onSort}
              onValueChange={onValueChange}
              isUpdating={isUpdating}
            />
          </Suspense>

          {/* Pagination Controls */}
          <div className="mt-4 flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <span className="text-sm">
              Page {page + 1} of {pageCount}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= pageCount - 1}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
