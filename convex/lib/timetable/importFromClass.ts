import { createLinkGroupId } from "./slotLinks.js";

export type ImportableSubject = {
  name: string;
  bgColor: string;
  textColor: string;
  iconName?: string;
  defaultNotesJson?: string;
};

export type ImportableSlot = {
  day: string;
  startTime: string;
  endTime: string;
  disabled: boolean;
  linkGroupId?: string;
};

export function subjectImportKey(name: string): string {
  return name.trim().toLowerCase();
}

export function slotImportKey(slot: { day: string; startTime: string; endTime: string }): string {
  return `${slot.day}|${slot.startTime}|${slot.endTime}`;
}

export function planImportedSubjects(
  sourceSubjects: Array<ImportableSubject>,
  existingNames: Iterable<string>,
): Array<ImportableSubject> {
  const taken = new Set([...existingNames].map(subjectImportKey));
  const planned: Array<ImportableSubject> = [];
  for (const subject of sourceSubjects) {
    const key = subjectImportKey(subject.name);
    if (!key || taken.has(key)) continue;
    taken.add(key);
    planned.push(subject);
  }
  return planned;
}

export function planImportedSlots(
  sourceSlots: Array<ImportableSlot>,
  existingSlots: Array<{ day: string; startTime: string; endTime: string }>,
  allowedDays?: ReadonlySet<string>,
): Array<ImportableSlot> {
  const taken = new Set(existingSlots.map(slotImportKey));
  const groupIdMap = new Map<string, string>();
  const planned: Array<ImportableSlot> = [];

  for (const slot of sourceSlots) {
    if (allowedDays && !allowedDays.has(slot.day)) continue;
    const key = slotImportKey(slot);
    if (taken.has(key)) continue;
    taken.add(key);

    let linkGroupId: string | undefined;
    if (slot.linkGroupId) {
      let mapped = groupIdMap.get(slot.linkGroupId);
      if (!mapped) {
        mapped = createLinkGroupId();
        groupIdMap.set(slot.linkGroupId, mapped);
      }
      linkGroupId = mapped;
    }

    planned.push({
      day: slot.day,
      startTime: slot.startTime,
      endTime: slot.endTime,
      disabled: slot.disabled,
      ...(linkGroupId ? { linkGroupId } : {}),
    });
  }

  const groupCounts = new Map<string, number>();
  for (const slot of planned) {
    if (!slot.linkGroupId) continue;
    groupCounts.set(slot.linkGroupId, (groupCounts.get(slot.linkGroupId) ?? 0) + 1);
  }
  for (const slot of planned) {
    if (slot.linkGroupId && (groupCounts.get(slot.linkGroupId) ?? 0) < 2) {
      delete slot.linkGroupId;
    }
  }

  return planned;
}
