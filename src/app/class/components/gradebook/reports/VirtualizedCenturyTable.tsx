// src/app/class/components/reports/century-skills/components/VirtualizedCenturyTable.tsx
"use client";

import React, { useMemo } from "react";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowUp, ArrowDown } from "lucide-react";
import type { StudentClassWithStudent } from "@/server/db/types";
import type { CenturySkillAchievement } from "@/server/db/schema";
import { cn } from "@/lib/utils";

// Exactly the keys in your FIELDS array
type SkillField =
  | "responsibility"
  | "organization"
  | "collaboration"
  | "communication"
  | "thinking"
  | "inquiry"
  | "risk_taking"
  | "open_minded";

type SortKey = "student_number" | "first_name" | "last_name";

interface VirtualizedCenturyTableProps {
  students: StudentClassWithStudent[];
  // each student_id → an object mapping each SkillField to its current achievement
  skillMap: Record<string, Record<SkillField, CenturySkillAchievement>>;
  // pass in the same FIELDS array
  FIELDS: readonly SkillField[];
  // your 4 options
  ACHIEVEMENTS: { value: CenturySkillAchievement; label: string }[];
  sortKey: SortKey;
  asc: boolean;
  onSort: (key: SortKey) => void;
  onValueChange: (
    student_id: string,
    field: SkillField,
    v: CenturySkillAchievement,
  ) => void;
  isUpdating: Set<string>;
}

export default function VirtualizedCenturyTable({
  students,
  skillMap,
  FIELDS,
  ACHIEVEMENTS,
  sortKey,
  asc,
  onSort,
  onValueChange,
  isUpdating,
}: VirtualizedCenturyTableProps) {
  // 1) sort the rows
  const sorted = useMemo(() => {
    return [...students].sort((a, b) => {
      let va: string | number, vb: string | number;
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

  // 2) little sort‐icon helper
  const SortIcon = ({ field }: { field: SortKey }) =>
    sortKey === field ? (
      asc ? (
        <ArrowUp size={14} className="ml-1 inline-block" />
      ) : (
        <ArrowDown size={14} className="ml-1 inline-block" />
      )
    ) : null;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead
            className="cursor-pointer"
            onClick={() => onSort("student_number")}
          >
            Student #<SortIcon field="student_number" />
          </TableHead>
          <TableHead
            className="cursor-pointer"
            onClick={() => onSort("first_name")}
          >
            First Name
            <SortIcon field="first_name" />
          </TableHead>
          <TableHead
            className="cursor-pointer"
            onClick={() => onSort("last_name")}
          >
            Last Name
            <SortIcon field="last_name" />
          </TableHead>
          {FIELDS.map((key) => (
            <TableHead key={key} className="min-w-[120px]">
              {key.replace("_", " ").toUpperCase()}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>

      <TableBody>
        {sorted.map((stu) => {
          // now `row` is fully typed
          const row = skillMap[stu.student_id]!;
          return (
            <TableRow key={stu.student_id}>
              <TableCell>{stu.student_number ?? ""}</TableCell>
              <TableCell>{stu.student_name_first_en}</TableCell>
              <TableCell>{stu.student_name_last_en}</TableCell>

              {FIELDS.map((field) => {
                const updateKey = `${stu.student_id}-${field}`;
                const disabled = isUpdating.has(updateKey);

                return (
                  <TableCell key={field} className="py-1">
                    <Tabs
                      value={row[field]}
                      onValueChange={(v) =>
                        onValueChange(
                          stu.student_id,
                          field,
                          v as CenturySkillAchievement,
                        )
                      }
                      className="w-full"
                    >
                      <TabsList
                        tabIndex={0}
                        className={cn(
                          "flex space-x-1 rounded-full",
                          "focus-within:ring-primary focus-within:ring-offset-background focus-within:ring-2 focus-within:ring-offset-2",
                        )}
                        onKeyDown={(e) => {
                          if (disabled) return;
                          const k = e.key.toUpperCase();
                          // instead of a `val: string`, call each literal directly
                          if (k === "A") {
                            e.preventDefault();
                            onValueChange(stu.student_id, field, "AB");
                          } else if (k === "C") {
                            e.preventDefault();
                            onValueChange(stu.student_id, field, "CD");
                          } else if (k === "P") {
                            e.preventDefault();
                            onValueChange(stu.student_id, field, "P");
                          } else if (k === "N") {
                            e.preventDefault();
                            onValueChange(stu.student_id, field, "NY");
                          }
                        }}
                      >
                        {ACHIEVEMENTS.map((opt) => (
                          <TabsTrigger
                            key={opt.value}
                            value={opt.value}
                            disabled={disabled}
                            className={cn(
                              "text-foreground flex-1 px-2 py-1 text-xs font-medium",
                              "data-[state=active]:bg-primary",
                              "data-[state=active]:text-foreground",
                              "data-[state=active]:shadow-sm",
                              "rounded-full transition-colors",
                            )}
                          >
                            {opt.label}
                          </TabsTrigger>
                        ))}
                      </TabsList>
                    </Tabs>
                  </TableCell>
                );
              })}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
