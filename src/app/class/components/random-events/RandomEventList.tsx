"use client";

import * as React from "react";
import type { RandomEvent } from "@/server/db/schema";
import { sqlTimestampToLocaleString } from "@/lib/utils";
import { useDeleteRandomEvent } from "./hooks/useDeleteRandomEvent";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";

import { Edit, Trash2 } from "lucide-react";
import { EditRandomEventDialog } from "./EditRandomEventDialog";
import Image from "next/image";
import type { FAIcon } from "@/components/ShadcnFontAwesomeIconPicker";

interface Props {
  events: RandomEvent[];
  classId: string;
}

export default function RandomEventsList({ events, classId }: Props) {
  if (events.length === 0) {
    return (
      <div className="text-muted-foreground py-16 text-center text-sm">
        No random events found.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {events.map((evt) => (
        <RandomEventCard key={evt.id} evt={evt} classId={classId} />
      ))}
    </div>
  );
}

function RandomEventCard({
  evt,
  classId,
}: {
  evt: RandomEvent;
  classId: string;
}) {
  const deleteMutation = useDeleteRandomEvent(classId);
  const [alertOpen, setAlertOpen] = React.useState(false);

  const onConfirmDelete = () => {
    setAlertOpen(false);
    deleteMutation.mutate(evt.id);
  };

  return (
    <Card className="border">
      <CardContent className="space-y-4">
        <CardHeader className="flex items-start justify-between p-0">
          <div>
            <CardTitle>{evt.name}</CardTitle>
            {evt.selected && (
              <CardDescription className="text-green-600">
                Selected
              </CardDescription>
            )}
            {evt.description && (
              <CardDescription>{evt.description}</CardDescription>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <EditRandomEventDialog
              classId={classId}
              event={evt}
              trigger={
                <Button variant="outline" size="sm">
                  <Edit />
                  <span className="hidden md:block">Edit</span>
                </Button>
              }
            />
            <AlertDialog open={alertOpen} onOpenChange={setAlertOpen}>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 />
                  <span className="hidden md:block">Delete</span>
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Random Event?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete{" "}
                    <span className="font-semibold">{evt.name}</span> and all of
                    its associated data, including the image and audio. This
                    action is irreversible. Are you sure?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="flex justify-end space-x-2">
                  <AlertDialogCancel asChild>
                    <Button variant="outline">Cancel</Button>
                  </AlertDialogCancel>
                  <AlertDialogAction asChild>
                    <Button
                      variant="destructive"
                      disabled={deleteMutation.isPending}
                      onClick={onConfirmDelete}
                    >
                      {deleteMutation.isPending ? "Deleting…" : "Delete"}
                    </Button>
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardHeader>

        <Separator />

        <div className="space-y-4">
          {evt.image && (
            <Image
              src={evt.image}
              alt={evt.name}
              width={100}
              height={100}
              className="max-h-48 w-full rounded object-cover"
            />
          )}
          {evt.audio && <audio controls src={evt.audio} className="w-full" />}
          {evt.icon &&
            (() => {
              try {
                const ic = JSON.parse(evt.icon) as FAIcon;
                return (
                  <i className={`${ic.prefix} fa-${ic.iconName} text-3xl`} />
                );
              } catch {
                return null;
              }
            })()}
        </div>

        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="font-medium">Created</dt>
            <dd>{sqlTimestampToLocaleString(evt.created_date)}</dd>
          </div>
          <div>
            <dt className="font-medium">Updated</dt>
            <dd>{sqlTimestampToLocaleString(evt.updated_date)}</dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}
