// src/app/class/components/random-events/RandomEventPickerModal.tsx
"use client";

import React, { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useUpdateRandomEvent } from "./hooks/useUpdateRandomEvent";
import type { RandomEvent } from "@/server/db/schema";
import { RandomEventsOptions } from "@/app/api/queryOptions";
import Image from "next/image";

interface Props {
  classId: string;
  trigger: React.ReactNode;
}

export function RandomEventPickerModal({ classId, trigger }: Props) {
  const { data: events = [], isLoading } = useQuery<RandomEvent[]>(
    RandomEventsOptions(classId),
  );

  const { mutate: updateEvent } = useUpdateRandomEvent(classId);

  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<RandomEvent | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [animatingEvent, setAnimatingEvent] = useState<RandomEvent | null>(
    null,
  );
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Function to stop current audio
  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
  };

  // Function to clear animation interval
  const clearAnimationInterval = () => {
    if (animationIntervalRef.current) {
      clearInterval(animationIntervalRef.current);
      animationIntervalRef.current = null;
    }
  };

  // pick one at random from a non-empty array
  function pickOne(arr: RandomEvent[]): RandomEvent | null {
    if (arr.length === 0) return null;
    return arr[
      Math.floor(Math.random() * arr.length)
    ] as unknown as RandomEvent;
  }

  // Function to start the roulette animation
  const startAnimation = (
    finalEvent: RandomEvent,
    availableEvents: RandomEvent[],
  ) => {
    setIsAnimating(true);
    setAnimatingEvent(availableEvents[0] ?? finalEvent);

    let currentIndex = 0;
    let speed = 100; // Initial speed in ms
    let elapsed = 0;
    const duration = 5000; // 5 seconds

    const animate = () => {
      elapsed += speed;
      currentIndex = (currentIndex + 1) % availableEvents.length;
      setAnimatingEvent(
        availableEvents[currentIndex] as unknown as RandomEvent,
      );

      // Gradually slow down the animation
      if (elapsed > duration * 0.7) {
        speed = Math.min(speed + 50, 500); // Slow down significantly
      } else if (elapsed > duration * 0.4) {
        speed = Math.min(speed + 20, 200); // Slow down moderately
      }

      if (elapsed >= duration) {
        clearAnimationInterval();
        setIsAnimating(false);
        setAnimatingEvent(null);
        setCurrent(finalEvent);
        return;
      }

      animationIntervalRef.current = setTimeout(animate, speed);
    };

    animate();
  };

  // 1) on open: if no current, choose & select exactly one
  useEffect(() => {
    if (!open) {
      setCurrent(null);
      setIsAnimating(false);
      setAnimatingEvent(null);
      clearAnimationInterval();
      stopAudio(); // Stop audio when modal closes
      return;
    }
    // don't re-pick if we've already selected one
    if (current || isAnimating) return;

    const unselected = events.filter((e) => !e.selected);

    if (unselected.length === 0) {
      // All events are selected → reset them all to false, then pick one
      const resetPromises = events
        .filter((e) => e.selected)
        .map(
          (e) =>
            new Promise<void>((resolve, reject) => {
              updateEvent(
                {
                  id: e.id,
                  name: e.name,
                  description: e.description ?? undefined,
                  image: e.image ?? undefined,
                  audio: e.audio ?? undefined,
                  icon: e.icon ?? undefined,
                  selected: false,
                },
                {
                  onError: reject,
                  onSuccess: () => resolve(),
                },
              );
            }),
        );

      // Wait for all reset operations to complete, then pick one
      Promise.all(resetPromises)
        .then(() => {
          const pick = pickOne(events)!;
          updateEvent(
            {
              id: pick.id,
              name: pick.name,
              description: pick.description ?? undefined,
              image: pick.image ?? undefined,
              audio: pick.audio ?? undefined,
              icon: pick.icon ?? undefined,
              selected: true,
            },
            { onError: console.error },
          );

          // Start animation with all events (since they were all just reset)
          startAnimation(pick, events);
        })
        .catch(console.error);

      return;
    }

    // Normal case: there are unselected events
    const pick = pickOne(unselected)!;
    updateEvent(
      {
        id: pick.id,
        name: pick.name,
        description: pick.description ?? undefined,
        image: pick.image ?? undefined,
        audio: pick.audio ?? undefined,
        icon: pick.icon ?? undefined,
        selected: true,
      },
      { onError: console.error },
    );

    // Start animation with unselected events
    startAnimation(pick, unselected);
  }, [open, events, current, updateEvent, isAnimating]);

  // 2) auto-play audio when `current` changes (after animation completes)
  useEffect(() => {
    // Stop any currently playing audio
    stopAudio();

    if (current?.audio && !isAnimating) {
      const audio = new Audio(current.audio);
      audioRef.current = audio;
      void audio.play().catch(console.error);
    }
  }, [current, isAnimating]);

  // 3) re-roll: either pick another or reset all then pick
  const handleReroll = async () => {
    if (!current || isAnimating) return;

    // Stop current audio before rerolling
    stopAudio();
    clearAnimationInterval();

    // find other un-selected events
    const others = events.filter((e) => !e.selected && e.id !== current.id);

    if (others.length > 0) {
      // normal case: unselect current, then pick & select one from others
      updateEvent(
        {
          id: current.id,
          name: current.name,
          description: current.description ?? undefined,
          image: current.image ?? undefined,
          audio: current.audio ?? undefined,
          icon: current.icon ?? undefined,
          selected: false,
        },
        { onError: console.error },
      );

      const next = pickOne(others)!;
      updateEvent(
        {
          id: next.id,
          name: next.name,
          description: next.description ?? undefined,
          image: next.image ?? undefined,
          audio: next.audio ?? undefined,
          icon: next.icon ?? undefined,
          selected: true,
        },
        { onError: console.error },
      );

      // Start animation with the unselected events (including the current one since we just unselected it)
      const availableForAnimation = [...others, current];
      startAnimation(next, availableForAnimation);
    } else {
      // all are selected → reset them all to false
      const resetPromises = events
        .filter((e) => e.selected)
        .map(
          (e) =>
            new Promise<void>((resolve, reject) => {
              updateEvent(
                {
                  id: e.id,
                  name: e.name,
                  description: e.description ?? undefined,
                  image: e.image ?? undefined,
                  audio: e.audio ?? undefined,
                  icon: e.icon ?? undefined,
                  selected: false,
                },
                {
                  onError: reject,
                  onSuccess: () => resolve(),
                },
              );
            }),
        );

      // Wait for all reset operations to complete
      await Promise.all(resetPromises);

      // Now pick from any event (since they're all reset)
      const next = pickOne(events)!;
      updateEvent(
        {
          id: next.id,
          name: next.name,
          description: next.description ?? undefined,
          image: next.image ?? undefined,
          audio: next.audio ?? undefined,
          icon: next.icon ?? undefined,
          selected: true,
        },
        { onError: console.error },
      );

      // Start animation with all events (since they were all just reset)
      startAnimation(next, events);
    }
  };

  // Determine what event to display
  const displayEvent = isAnimating ? animatingEvent : current;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>

      <DialogContent className="h-full max-h-[100dvh] w-full min-w-[100dvw] p-6">
        <DialogHeader>
          <DialogTitle>Random Event</DialogTitle>
          <DialogClose className="absolute top-4 right-4" />
        </DialogHeader>

        <div className="flex grow flex-col items-center justify-center space-y-6">
          {isLoading ? (
            <p>Loading events…</p>
          ) : displayEvent ? (
            <>
              <h1
                className={`mb-16 text-center text-6xl font-bold transition-all duration-300 ${
                  isAnimating ? "scale-110 text-blue-500" : "scale-100"
                }`}
              >
                {displayEvent.name}
              </h1>
              {displayEvent.image && (
                <div
                  className={`transition-all duration-300 ${
                    isAnimating
                      ? "scale-105 opacity-80"
                      : "scale-100 opacity-100"
                  }`}
                >
                  <Image
                    src={displayEvent.image}
                    alt={displayEvent.name}
                    width={400}
                    height={400}
                    className="object-contain"
                    placeholder="blur"
                    blurDataURL={displayEvent.image}
                  />
                </div>
              )}
              <p
                className={`text-center text-2xl whitespace-pre-wrap transition-all duration-300 ${
                  isAnimating ? "opacity-60" : "opacity-100"
                }`}
              >
                {displayEvent.description}
              </p>
              {isAnimating && (
                <div className="flex items-center space-x-2 text-blue-500">
                  <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-blue-500"></div>
                  <span className="text-sm">Selecting random event...</span>
                </div>
              )}
            </>
          ) : (
            <p>No more unselected events!</p>
          )}
        </div>

        <div className="flex justify-center space-x-4">
          <Button
            variant="secondary"
            onClick={handleReroll}
            disabled={isLoading || !current || isAnimating}
          >
            Re-roll
          </Button>
          <DialogClose asChild>
            <Button>Close</Button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}
