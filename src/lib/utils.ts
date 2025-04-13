import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export async function retry<T>(
  fn: () => Promise<T>,
  retries = 3,
  delay = 1000
): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === retries - 1) throw error;
      // Wait before retrying (using exponential backoff)
      await new Promise((resolve) => setTimeout(resolve, delay * Math.pow(2, i)));
    }
  }
  // This return is just to please TypeScript
  throw new Error("Retry attempts exhausted");
}
