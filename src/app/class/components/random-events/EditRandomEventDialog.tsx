"use client";

import * as React from "react";
import type { RandomEvent } from "@/server/db/schema";
import { toast } from "sonner";
import { useUpdateRandomEvent } from "./hooks/useUpdateRandomEvent";
import { useUploadThing } from "@/lib/uploadthing";
import ShadcnFontAwesomeIconPicker from "@/components/ShadcnFontAwesomeIconPicker";
import type { IconName, IconPrefix } from "@fortawesome/fontawesome-svg-core";

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

// Type for the expected icon structure
interface IconData {
  name: IconName;
  prefix: IconPrefix;
}

// Type guard to check if the parsed object has the expected structure
function isIconData(obj: unknown): obj is IconData {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "name" in obj &&
    "prefix" in obj &&
    typeof (obj as Record<string, unknown>).name === "string" &&
    typeof (obj as Record<string, unknown>).prefix === "string"
  );
}

export function EditRandomEventDialog({ classId, event, trigger }: Props) {
  const [open, setOpen] = React.useState(false);
  const { mutate, isPending } = useUpdateRandomEvent(classId);

  // Upload hooks
  const { startUpload: startImageUpload, isUploading: isImageUploading } =
    useUploadThing("imageUploader");
  const { startUpload: startAudioUpload, isUploading: isAudioUploading } =
    useUploadThing("audioUploader");

  // Parse existing icon from event
  const getInitialIcon = (): IconData | null => {
    if (!event.icon) return null;
    try {
      const parsed: unknown = JSON.parse(event.icon);
      if (isIconData(parsed)) {
        return {
          name: parsed.name,
          prefix: parsed.prefix,
        };
      }
      return null;
    } catch {
      return null;
    }
  };

  // form state
  const [name, setName] = React.useState(event.name);
  const [description, setDescription] = React.useState(event.description ?? "");
  const [imageUrl, setImageUrl] = React.useState<string | null>(event.image);
  const [audioUrl, setAudioUrl] = React.useState<string | null>(event.audio);
  const [selected, setSelected] = React.useState(event.selected);
  const [selectedIcon, setSelectedIcon] = React.useState<IconData | null>(
    getInitialIcon(),
  );

  // File state for pending uploads
  const [pendingImageFile, setPendingImageFile] = React.useState<File | null>(
    null,
  );
  const [pendingAudioFile, setPendingAudioFile] = React.useState<File | null>(
    null,
  );

  React.useEffect(() => {
    if (open) {
      setName(event.name);
      setDescription(event.description ?? "");
      setImageUrl(event.image);
      setAudioUrl(event.audio);
      setSelected(event.selected);
      setSelectedIcon(getInitialIcon());
      setPendingImageFile(null);
      setPendingAudioFile(null);
    }
  }, [open, event]);

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

      // Now save the event with the uploaded URLs
      mutate(
        {
          id: event.id,
          name: name.trim(),
          description: description.trim() || undefined,
          image: finalImageUrl ?? undefined,
          audio: finalAudioUrl ?? undefined,
          icon: selectedIcon ? JSON.stringify(selectedIcon) : undefined,
          selected,
        },
        {
          onSuccess: () => {
            setOpen(false);
            setPendingImageFile(null);
            setPendingAudioFile(null);
          },
          onError: (error) => {
            console.error(error);
            toast.error("Failed to update event");
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
          <DialogTitle>Edit Random Event</DialogTitle>
          <DialogDescription>
            Change your event a name, optional description, image, audio, and/or
            icon.
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
            <Label>Image (URL or file)</Label>
            <Input
              type="url"
              placeholder="Paste image URL"
              value={imageUrl ?? ""}
              onChange={(e) => setImageUrl(e.target.value || null)}
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
              onChange={(e) => setAudioUrl(e.target.value || null)}
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
              <Button variant="outline" disabled={isUploading}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isPending || isUploading}>
              {isUploading
                ? "Uploading..."
                : isPending
                  ? "Saving..."
                  : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
