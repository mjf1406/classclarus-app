// src/utils/uploadthing.ts
import {
  generateUploadButton,
  generateUploadDropzone,
} from "@uploadthing/react";
import type { OurFileRouter } from "@/app/api/uploadthing/core";

// This already fixes the two‐generic‐params issue.
// Now UploadButton/UploadDropzone know your TRouter.
export const UploadButton = generateUploadButton<OurFileRouter>();
export const UploadDropzone = generateUploadDropzone<OurFileRouter>();
