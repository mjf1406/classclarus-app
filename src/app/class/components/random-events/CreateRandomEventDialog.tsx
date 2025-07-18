// src/app/class/components/random-events/CreateRandomEventDialog.tsx
"use client";

import * as React from "react";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { UploadButton } from "@/lib/uploadthing";
import ShadcnFontAwesomeIconPicker from "@/components/ShadcnFontAwesomeIconPicker";
import type { IconName, IconPrefix } from "@fortawesome/fontawesome-svg-core";
import { useCreateRandomEvent } from "./hooks/useCreateRandomEvent";

interface CreateRandomEventDialogProps {
  classId: string;
  trigger: React.ReactNode;
}

export const CreateRandomEventDialog: React.FC<
  CreateRandomEventDialogProps
> = ({ classId, trigger }) => {
  const [open, setOpen] = React.useState(false);
  const { mutate, isPending } = useCreateRandomEvent(classId);

  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [imageUrl, setImageUrl] = React.useState<string | null>(null);
  const [audioUrl, setAudioUrl] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState(false);

  // local state for the chosen icon
  const [selectedIcon, setSelectedIcon] = React.useState<{
    name: IconName;
    prefix: IconPrefix;
  } | null>(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    setOpen(false);
    mutate(
      {
        class_id: classId,
        name: name.trim(),
        description: description.trim() || null,
        image: imageUrl,
        audio: audioUrl,
        icon: selectedIcon ? JSON.stringify(selectedIcon) : null,
        selected,
      },
      {
        onSuccess: () => {
          setName("");
          setDescription("");
          setImageUrl(null);
          setAudioUrl(null);
          setSelected(false);
          setSelectedIcon(null);
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
          <DialogTitle>Create Random Event</DialogTitle>
          <DialogDescription>
            Give your event a name, optional description, image, audio, and/or
            icon.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Name */}
          <div className="grid gap-1">
            <Label htmlFor="re-name">Name *</Label>
            <Input
              id="re-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          {/* Description */}
          <div className="grid gap-1">
            <Label htmlFor="re-desc">Description</Label>
            <Textarea
              id="re-desc"
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
              onChange={(e) => setImageUrl(e.target.value.trim() || null)}
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
              onChange={(e) => setAudioUrl(e.target.value.trim() || null)}
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
            <ShadcnFontAwesomeIconPicker
              selectedIcon={selectedIcon ?? undefined}
              onSelectIcon={(name, prefix) => setSelectedIcon({ name, prefix })}
            />
          </div>

          <DialogFooter className="flex justify-end space-x-2">
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving…" : "Create Event"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
