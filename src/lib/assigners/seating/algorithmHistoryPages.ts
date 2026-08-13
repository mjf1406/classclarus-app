export type AlgorithmHistoryPage<T> = {
  page: T[];
  isDone: boolean;
  continueCursor: string;
};

/** Collect every page of layout algorithm history, recording the cursor used for each fetch. */
export async function collectAlgorithmHistoryPages<T>(
  fetchPage: (cursor: string | null) => Promise<AlgorithmHistoryPage<T>>,
): Promise<{ rows: T[]; cursors: Array<string | null> }> {
  const rows: T[] = [];
  const cursors: Array<string | null> = [];
  let cursor: string | null = null;
  let isDone = false;
  while (!isDone) {
    cursors.push(cursor);
    const result = await fetchPage(cursor);
    rows.push(...result.page);
    cursor = result.continueCursor;
    isDone = result.isDone;
  }
  return { rows, cursors };
}
