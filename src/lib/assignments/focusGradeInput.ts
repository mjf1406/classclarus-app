import type { KeyboardEvent } from "react";

const GRADE_INPUT_SELECTOR = "[data-grade-input]";

/** Focus the next/previous scoring control in DOM order within the grade table. */
export function focusAdjacentGradeInput(current: HTMLElement, direction: 1 | -1): boolean {
  const root =
    current.closest<HTMLElement>("[data-grade-table]") ?? current.ownerDocument?.body ?? null;
  if (!root) return false;

  const inputs = Array.from(root.querySelectorAll<HTMLElement>(GRADE_INPUT_SELECTOR)).filter(
    (el) =>
      !el.hasAttribute("disabled") &&
      el.getAttribute("aria-disabled") !== "true" &&
      el.tabIndex >= 0,
  );
  if (inputs.length === 0) return false;

  let index = inputs.indexOf(current);
  if (index < 0) {
    const owner =
      current.closest<HTMLElement>(GRADE_INPUT_SELECTOR) ??
      current.querySelector<HTMLElement>(GRADE_INPUT_SELECTOR);
    if (!owner) return false;
    index = inputs.indexOf(owner);
    if (index < 0) return false;
  }

  const next = inputs[index + direction];
  if (!next) return false;
  next.focus();
  if (next instanceof HTMLInputElement) {
    next.select();
  }
  return true;
}

export function handleGradeInputKeyDown(event: KeyboardEvent<HTMLElement>): void {
  if (event.key === "Enter") {
    if (event.ctrlKey || event.metaKey) {
      return;
    }
    event.preventDefault();
    focusAdjacentGradeInput(event.currentTarget, event.shiftKey ? -1 : 1);
    return;
  }
  if (event.key === "Tab") {
    const moved = focusAdjacentGradeInput(event.currentTarget, event.shiftKey ? -1 : 1);
    if (moved) {
      event.preventDefault();
    }
  }
}
