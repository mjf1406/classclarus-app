"use client";

import * as React from "react";
import defaultEvents from "@/lib/default_random_events.json";
import { toast } from "sonner";

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

import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "@/components/ui/table";

import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { useAddDefaultRandomEvents } from "./hooks/useAddDefaultRandomEvents";

interface Props {
  classId: string;
  trigger: React.ReactNode;
}

export function AddDefaultEventsDialog({ classId, trigger }: Props) {
  const [open, setOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<boolean[]>(
    defaultEvents.map(() => false),
  );

  const { mutate: addDefaults, isPending: isAdding } =
    useAddDefaultRandomEvents(classId);

  const isAnySelected = selected.some(Boolean);

  // Build the array of events to add
  const toAdd = React.useMemo(
    () => defaultEvents.filter((_, idx) => selected[idx]),
    [selected],
  );

  function toggle(idx: number, checked: boolean) {
    setSelected((prev) => {
      const next = [...prev];
      next[idx] = checked;
      return next;
    });
  }

  function handleAdd() {
    if (!isAnySelected) return;
    addDefaults(toAdd, {
      onSuccess: () => {
        toast.success("Default events added");
        setOpen(false);
      },
      onError: (err) => {
        console.error(err);
        toast.error("Failed to add events");
      },
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="w-full max-w-4xl">
        <DialogHeader>
          <DialogTitle>Add Default Random Events</DialogTitle>
          <DialogDescription>
            Select one or more default events to add to your class.
          </DialogDescription>
        </DialogHeader>

        <Table className="table-auto">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]">Select</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {defaultEvents.map((evt, idx) => (
              <TableRow key={idx}>
                <TableCell>
                  <Checkbox
                    checked={selected[idx]}
                    onCheckedChange={(v) => toggle(idx, !!v)}
                    className="h-6 w-6"
                  />
                </TableCell>
                <TableCell>{evt.name}</TableCell>
                <TableCell className="max-w-xs break-words whitespace-normal">
                  {evt.description}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <DialogFooter className="flex justify-end space-x-2">
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={handleAdd} disabled={!isAnySelected || isAdding}>
            {isAdding ? "Adding…" : "Add Selected Events"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
