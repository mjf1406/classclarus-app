"use client";

import React, { useRef } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import sillyMonkey from "public/img/silly-monkey.png";
import { useSSRSafeLocalStorage } from "@/hooks/useSsrSafeLocalStorage";

interface StudentImageProps {
  className?: string;
}

export function StudentImage({ className = "" }: StudentImageProps) {
  // Store the image data in local storage
  const [imageData, setImageData] = useSSRSafeLocalStorage<string>(
    "studentImage",
    "",
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setImageData(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div
      className={`group relative inline-block h-[225px] w-[225px] ${className}`}
    >
      <Image
        src={imageData || sillyMonkey}
        alt="Student Image"
        width={225}
        height={225}
        className="cursor-pointer rounded"
        onClick={triggerFileInput}
      />

      <div className="absolute inset-0">
        {/* Background overlay remains at 50% opacity on hover */}
        <div className="bg-primary absolute inset-0 opacity-0 transition-opacity group-hover:opacity-70" />
        {/* Button overlay will animate to full opacity on hover */}
        <div className="absolute inset-0 flex items-center justify-center">
          <Button
            variant="secondary"
            onClick={triggerFileInput}
            className="opacity-0 transition-opacity group-hover:opacity-100"
          >
            Upload
          </Button>
        </div>
      </div>

      {/* Hidden file input */}
      <input
        type="file"
        accept="image/*"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
}
