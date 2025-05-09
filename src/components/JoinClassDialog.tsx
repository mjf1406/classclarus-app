"use client";

import React, { useState, useEffect, type FormEvent } from "react";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
  DialogFooter,
} from "@/components/ui/dialog";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ClipboardPaste,
  Handshake,
  HeartHandshake,
  Loader2,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import { joinClass } from "@/app/class/actions/joinClass";

const JoinClassDialog = () => {
  const [classCode, setClassCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const codeFromQuery = searchParams.get("join_code");
    if (codeFromQuery) {
      setClassCode(codeFromQuery);
      setIsOpen(true);
    }
  }, [searchParams]);

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setClassCode(text);
    } catch (error) {
      alert("Failed to read from clipboard. Please try again.");
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    if (!classCode.trim()) {
      toast.info("Please enter or paste a valid class code.");
      setIsLoading(false);
      return;
    }

    try {
      const response = await joinClass(classCode);

      if (response.success) {
        toast.success("You have successfully joined the class!");
        setIsOpen(false); // Close the dialog
        // Optionally refresh or redirect if desired:
        // router.refresh();
        // or window.location.reload();
      } else {
        toast.error(
          response.message ?? "Unable to join the class. Please try again.",
        );
      }
    } catch (error) {
      toast.error(
        "An error occurred while joining the class. Please try again.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {/* You can also hide the DialogTrigger entirely if you ONLY want it to appear
          via ?join_code=... in the URL. For now, leaving it so user can also
          manually trigger the dialog. */}
      <DialogTrigger asChild>
        <Button variant={"secondary"} className="text-foreground">
          <Handshake /> <span className="hidden sm:block">Join class</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Join a Class</DialogTitle>
          <DialogDescription>
            Enter the class code to join as an assistant teacher.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="mt-4">
          <div className="mb-4">
            <label
              htmlFor="classCode"
              className="block text-sm font-medium text-gray-700"
            >
              Class Code
            </label>
            <div className="flex items-center gap-1">
              <Input
                id="classCode"
                type="text"
                value={classCode}
                onChange={(e) => setClassCode(e.target.value)}
                required
                placeholder="Enter your class code"
                className="mt-1 block w-full"
                disabled={isLoading}
              />
              <TooltipProvider>
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={handlePasteFromClipboard}
                      disabled={isLoading}
                    >
                      <ClipboardPaste size={20} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Paste</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
          <DialogFooter className="mt-6 flex justify-end">
            <DialogClose asChild>
              <Button variant="outline" disabled={isLoading}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" variant="default" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                  Joining...
                </>
              ) : (
                "Join"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default JoinClassDialog;
