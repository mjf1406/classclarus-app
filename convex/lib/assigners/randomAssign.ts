export type RandomAssignScope = "class" | "groups";

export type RandomAssignRecipient = {
  studentUserId: string;
  groupId?: string;
  groupName?: string;
};

export type RandomAssignAssignment = {
  studentUserId: string;
  item: string;
  groupId?: string;
  groupName?: string;
};

export function shuffleInPlace<T>(items: T[], random: () => number = Math.random): T[] {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const tmp = items[i]!;
    items[i] = items[j]!;
    items[j] = tmp;
  }
  return items;
}

/**
 * Build a shuffled item pool for the given recipient count.
 * Replicates off: at most min(recipientCount, items.length) unique items.
 * Replicates on: each item appears floor(n/k) times; first n%k items get one extra.
 */
export function expandItems(
  items: ReadonlyArray<string>,
  recipientCount: number,
  replicates: boolean,
  random: () => number = Math.random,
): string[] {
  if (recipientCount <= 0 || items.length === 0) return [];

  if (!replicates) {
    const shuffled = shuffleInPlace([...items], random);
    return shuffled.slice(0, Math.min(recipientCount, items.length));
  }

  const k = items.length;
  const base = Math.floor(recipientCount / k);
  const remainder = recipientCount % k;
  const pool: string[] = [];
  for (let i = 0; i < k; i += 1) {
    const count = base + (i < remainder ? 1 : 0);
    for (let j = 0; j < count; j += 1) {
      pool.push(items[i]!);
    }
  }
  return shuffleInPlace(pool, random);
}

export function assignRandom(args: {
  items: ReadonlyArray<string>;
  recipients: ReadonlyArray<RandomAssignRecipient>;
  scope: RandomAssignScope;
  replicates: boolean;
  random?: () => number;
}): RandomAssignAssignment[] {
  const random = args.random ?? Math.random;

  if (args.scope === "class") {
    const shuffledRecipients = shuffleInPlace([...args.recipients], random);
    const itemPool = expandItems(args.items, shuffledRecipients.length, args.replicates, random);
    const count = Math.min(shuffledRecipients.length, itemPool.length);
    const result: RandomAssignAssignment[] = [];
    for (let i = 0; i < count; i += 1) {
      const recipient = shuffledRecipients[i]!;
      result.push({
        studentUserId: recipient.studentUserId,
        item: itemPool[i]!,
        groupId: recipient.groupId,
        groupName: recipient.groupName,
      });
    }
    return result;
  }

  const byGroup = new Map<string, RandomAssignRecipient[]>();
  for (const recipient of args.recipients) {
    if (!recipient.groupId) continue;
    const list = byGroup.get(recipient.groupId) ?? [];
    list.push(recipient);
    byGroup.set(recipient.groupId, list);
  }

  const result: RandomAssignAssignment[] = [];
  for (const groupRecipients of byGroup.values()) {
    const shuffledRecipients = shuffleInPlace([...groupRecipients], random);
    const itemPool = expandItems(args.items, shuffledRecipients.length, args.replicates, random);
    const count = Math.min(shuffledRecipients.length, itemPool.length);
    for (let i = 0; i < count; i += 1) {
      const recipient = shuffledRecipients[i]!;
      result.push({
        studentUserId: recipient.studentUserId,
        item: itemPool[i]!,
        groupId: recipient.groupId,
        groupName: recipient.groupName,
      });
    }
  }
  return result;
}
