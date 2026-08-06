import { Toast as ToastPrimitive } from "@base-ui/react/toast";

const createToastManager = ToastPrimitive.createToastManager;
const useToastManager = ToastPrimitive.useToastManager;
const toast = createToastManager();

export { createToastManager, toast, useToastManager };
