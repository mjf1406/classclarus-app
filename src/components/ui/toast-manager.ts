import type { ReactNode } from "react";
import { Toast as ToastPrimitive } from "@base-ui/react/toast";

export type ToastExtraAction = {
  label: ReactNode;
  onClick: () => void;
};

export type ToastClassDeletionPayload = {
  progress: number;
  pending: boolean;
  label: string;
};

export type ToastData = {
  extraActions?: Array<ToastExtraAction>;
  classDeletion?: ToastClassDeletionPayload;
};

const createToastManager = ToastPrimitive.createToastManager;
const useToastManager = ToastPrimitive.useToastManager;
const toast = createToastManager<ToastData>();

export { createToastManager, toast, useToastManager };
