"use client";

import { useState, useEffect } from "react";

export function useSSRSafeLocalStorage<T>(
  key: string,
  defaultValue: T,
): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(defaultValue);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        setValue(JSON.parse(stored));
      }
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error);
    }
  }, [key]);

  const setStoredValue = (newValue: T) => {
    setValue(newValue);
    if (isClient) {
      try {
        localStorage.setItem(key, JSON.stringify(newValue));
      } catch (error) {
        console.warn(`Error setting localStorage key "${key}":`, error);
      }
    }
  };

  return [value, setStoredValue];
}
