"use client";

import * as React from "react";
import type { RandomEvent } from "@/server/db/schema";
import { toast } from "sonner";
import { useSSRSafeLocalStorage } from "@/hooks/useSsrSafeLocalStorage";
import { useUpdateRandomEvent } from "./hooks/useUpdateRandomEvent";
import { UploadButton } from "@/lib/uploadthing";
import StudentIconPicker from "@/app/[classId]/[studentId]/components/StudentIconPicker";

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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

interface Props {
  classId: string;
  event: RandomEvent;
  trigger: React.ReactNode;
}

export function EditRandomEventDialog({ classId, event, trigger }: Props) {
  const [open, setOpen] = React.useState(false);
  const { mutate, isPending } = useUpdateRandomEvent(classId);

  // form state
  const [name, setName] = React.useState(event.name);
  const [description, setDescription] = React.useState(event.description ?? "");
  const [imageUrl, setImageUrl] = React.useState<string | null>(event.image);
  const [audioUrl, setAudioUrl] = React.useState<string | null>(event.audio);
  const [selected, setSelected] = React.useState(event.selected);

  // reuse your StudentIconPicker + localStorage for icon
  const [storedIcon] = useSSRSafeLocalStorage<{
    name: string;
    prefix: string;
  } | null>("selectedIcon", null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    setOpen(false);
    const iconToSave = storedIcon ? JSON.stringify(storedIcon) : event.icon;

    mutate(
      {
        id: event.id,
        name: name.trim(),
        description: description.trim() ?? undefined,
        image: imageUrl ?? undefined,
        audio: audioUrl ?? undefined,
        icon: iconToSave ?? undefined,
        selected,
      },
      {
        onSuccess: () => {
          setOpen(false);
        },
        onError: (error) => {
          console.error(error);
          toast.error("Failed to update event");
          setOpen(true);
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit Random Event</DialogTitle>
          <DialogDescription>
            Change name, description, image/audio, icon, or “selected” state.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Name */}
          <div className="grid gap-1">
            <Label htmlFor="re-edit-name">Name *</Label>
            <Input
              id="re-edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          {/* Description */}
          <div className="grid gap-1">
            <Label htmlFor="re-edit-desc">Description</Label>
            <Textarea
              id="re-edit-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          {/* Image */}
          <div className="grid gap-1">
            <Label>Image (URL or upload)</Label>
            <Input
              type="url"
              placeholder="Paste image URL"
              value={imageUrl ?? ""}
              onChange={(e) => setImageUrl(e.target.value || null)}
            />
            <UploadButton
              endpoint="imageUploader"
              className="mt-2"
              onClientUploadComplete={(res) => {
                const first = res?.[0];
                if (first?.url) setImageUrl(first.url);
              }}
              onUploadError={(err) => {
                console.error(err);
                toast.error("Image upload failed");
              }}
            />
          </div>

          {/* Audio */}
          <div className="grid gap-1">
            <Label>Audio (URL or upload)</Label>
            <Input
              type="url"
              placeholder="Paste audio URL"
              value={audioUrl ?? ""}
              onChange={(e) => setAudioUrl(e.target.value || null)}
            />
            <UploadButton
              endpoint="audioUploader"
              className="mt-2"
              onClientUploadComplete={(res) => {
                const first = res?.[0];
                if (first?.url) setAudioUrl(first.url);
              }}
              onUploadError={(err) => {
                console.error(err);
                toast.error("Audio upload failed");
              }}
            />
          </div>

          {/* Icon */}
          <div className="grid gap-1">
            <Label>Icon</Label>
            <StudentIconPicker />
            {storedIcon && (
              <div className="mt-1 flex items-center space-x-2">
                <span>Preview:</span>
                <i
                  className={`${storedIcon.prefix} fa-${storedIcon.name} text-2xl`}
                />
              </div>
            )}
          </div>

          {/* Selected */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="re-edit-selected"
              checked={selected}
              onCheckedChange={(v) => setSelected(!!v)}
            />
            <Label htmlFor="re-edit-selected">Selected</Label>
          </div>

          <DialogFooter className="flex justify-end space-x-2">
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving…" : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
