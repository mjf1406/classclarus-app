import React, { type ReactNode, useState } from "react";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUpdateRandomization } from "../hooks/useUpdateRandomization";
import type { RandomizationWithStudents } from "@/server/db/schema";
import { toast } from "sonner";

interface EditRandomizationDialogProps {
  trigger: ReactNode;
  randomization: RandomizationWithStudents;
  classId: string;
}

export function EditRandomizationDialog({
  trigger,
  randomization,
  classId,
}: EditRandomizationDialogProps) {
  const [name, setName] = useState(randomization.name);
  const [open, setOpen] = useState(false);

  const { mutate: updateRandomization, isPending } =
    useUpdateRandomization(classId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setOpen(false);

    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error("Name cannot be empty");
      return;
    }

    if (trimmedName === randomization.name) {
      setOpen(false);
      return;
    }

    updateRandomization(
      {
        id: randomization.id,
        name: trimmedName,
      },
      {
        onSuccess: () => {
          setOpen(false);
        },
      },
    );
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setName(randomization.name); // Reset on close
    }
    setOpen(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Randomization</DialogTitle>
          <DialogDescription>
            Update the name for this randomization.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter randomization name..."
                required
                maxLength={100}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Updating..." : "Update"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
