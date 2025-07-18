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
import ShadcnFontAwesomeIconPicker from "@/components/ShadcnFontAwesomeIconPicker";
import type { IconName, IconPrefix } from "@fortawesome/fontawesome-svg-core";
import { useCreateRandomEvent } from "./hooks/useCreateRandomEvent";
import { useUploadThing } from "@/lib/uploadthing";

interface CreateRandomEventDialogProps {
  classId: string;
  trigger: React.ReactNode;
}

export const CreateRandomEventDialog: React.FC<
  CreateRandomEventDialogProps
> = ({ classId, trigger }) => {
  const [open, setOpen] = React.useState(false);
  const { mutate, isPending } = useCreateRandomEvent(classId);

  // Upload hooks
  const { startUpload: startImageUpload, isUploading: isImageUploading } =
    useUploadThing("imageUploader");
  const { startUpload: startAudioUpload, isUploading: isAudioUploading } =
    useUploadThing("audioUploader");

  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [imageUrl, setImageUrl] = React.useState<string | null>(null);
  const [audioUrl, setAudioUrl] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState(false);

  // File state for pending uploads
  const [pendingImageFile, setPendingImageFile] = React.useState<File | null>(
    null,
  );
  const [pendingAudioFile, setPendingAudioFile] = React.useState<File | null>(
    null,
  );

  // local state for the chosen icon
  const [selectedIcon, setSelectedIcon] = React.useState<{
    name: IconName;
    prefix: IconPrefix;
  } | null>(null);

  const isUploading = isImageUploading || isAudioUploading;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }

    try {
      let finalImageUrl = imageUrl;
      let finalAudioUrl = audioUrl;

      // Upload image if there's a pending file
      if (pendingImageFile) {
        const imageUploadResult = await startImageUpload([pendingImageFile]);
        if (imageUploadResult?.[0]?.url) {
          finalImageUrl = imageUploadResult[0].url;
        } else {
          throw new Error("Image upload failed");
        }
      }

      // Upload audio if there's a pending file
      if (pendingAudioFile) {
        const audioUploadResult = await startAudioUpload([pendingAudioFile]);
        if (audioUploadResult?.[0]?.url) {
          finalAudioUrl = audioUploadResult[0].url;
        } else {
          throw new Error("Audio upload failed");
        }
      }

      // Now create the event with the uploaded URLs
      mutate(
        {
          class_id: classId,
          name: name.trim(),
          description: description.trim() || null,
          image: finalImageUrl,
          audio: finalAudioUrl,
          icon: selectedIcon ? JSON.stringify(selectedIcon) : null,
          old_files: null,
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
            setPendingImageFile(null);
            setPendingAudioFile(null);
            setOpen(false);
          },
          onError: (error) => {
            console.error(error);
            toast.error("Failed to create event");
          },
        },
      );
    } catch (error) {
      console.error(error);
      toast.error("Upload failed. Please try again.");
    }
  };

  const handleImageFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPendingImageFile(file);
      // Clear the URL input when a file is selected
      setImageUrl(null);
    }
  };

  const handleAudioFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPendingAudioFile(file);
      // Clear the URL input when a file is selected
      setAudioUrl(null);
    }
  };

  const clearImageFile = () => {
    setPendingImageFile(null);
  };

  const clearAudioFile = () => {
    setPendingAudioFile(null);
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
            <Label>Image (URL or file)</Label>
            <Input
              type="url"
              placeholder="Paste image URL"
              value={imageUrl ?? ""}
              onChange={(e) => setImageUrl(e.target.value.trim() || null)}
              disabled={!!pendingImageFile}
            />
            <div className="flex items-center gap-2">
              <Input
                type="file"
                accept="image/*"
                onChange={handleImageFileSelect}
                className="flex-1"
              />
              {pendingImageFile && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={clearImageFile}
                >
                  Clear
                </Button>
              )}
            </div>
            {pendingImageFile && (
              <p className="text-muted-foreground text-sm">
                Selected: {pendingImageFile.name}
              </p>
            )}
          </div>

          {/* Audio */}
          <div className="grid gap-1">
            <Label>Audio (URL or file)</Label>
            <Input
              type="url"
              placeholder="Paste audio URL"
              value={audioUrl ?? ""}
              onChange={(e) => setAudioUrl(e.target.value.trim() || null)}
              disabled={!!pendingAudioFile}
            />
            <div className="flex items-center gap-2">
              <Input
                type="file"
                accept="audio/*"
                onChange={handleAudioFileSelect}
                className="flex-1"
              />
              {pendingAudioFile && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={clearAudioFile}
                >
                  Clear
                </Button>
              )}
            </div>
            {pendingAudioFile && (
              <p className="text-muted-foreground text-sm">
                Selected: {pendingAudioFile.name}
              </p>
            )}
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
              <Button variant="outline" disabled={isUploading}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isPending || isUploading}>
              {isUploading
                ? "Uploading..."
                : isPending
                  ? "Saving..."
                  : "Create Event"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
