// src/utils/uploadthing.ts
import {
  generateUploadButton,
  generateUploadDropzone,
  generateReactHelpers,
} from "@uploadthing/react";
import type { OurFileRouter } from "@/app/api/uploadthing/core";

// This already fixes the two‐generic‐params issue.
// Now UploadButton/UploadDropzone know your TRouter.
export const UploadButton = generateUploadButton<OurFileRouter>();
export const UploadDropzone = generateUploadDropzone<OurFileRouter>();

// Add the useUploadThing hook
export const { useUploadThing, uploadFiles } =
  generateReactHelpers<OurFileRouter>();
