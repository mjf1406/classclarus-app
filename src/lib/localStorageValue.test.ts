import { afterEach, beforeEach, describe, expect, test } from "vite-plus/test";

import {
  getLocalStorageValueSnapshot,
  readLocalStorageValue,
  writeLocalStorageValue,
} from "./localStorageValue";

const KEY = "test-local-storage-value";

function isMode(value: string): value is "list" | "grid" {
  return value === "list" || value === "grid";
}

function installMemoryLocalStorage() {
  const store = new Map<string, string>();
  const localStorageMock = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
  };
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: localStorageMock,
  });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: localStorageMock,
      dispatchEvent: () => true,
      addEventListener: () => {},
      removeEventListener: () => {},
    },
  });
  return store;
}

beforeEach(() => {
  installMemoryLocalStorage();
});

afterEach(() => {
  // Drop test globals so other suites stay isolated.
  Reflect.deleteProperty(globalThis, "localStorage");
  Reflect.deleteProperty(globalThis, "window");
});

describe("localStorageValue", () => {
  test("returns default when missing or invalid", () => {
    expect(readLocalStorageValue(KEY, "list", isMode)).toBe("list");
    localStorage.setItem(KEY, "nope");
    expect(readLocalStorageValue(KEY, "list", isMode)).toBe("list");
  });

  test("reads and writes validated values", () => {
    writeLocalStorageValue(KEY, "grid");
    expect(readLocalStorageValue(KEY, "list", isMode)).toBe("grid");
    expect(getLocalStorageValueSnapshot(KEY, "list", isMode)).toBe("grid");
  });
});
