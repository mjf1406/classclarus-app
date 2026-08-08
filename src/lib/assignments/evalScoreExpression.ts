/**
 * Evaluate a simple arithmetic expression for grade entry.
 * Supports + - * / and parentheses. Returns null when invalid/empty.
 */
export function evalScoreExpression(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") {
    return null;
  }

  // Plain number (including decimals)
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : null;
  }

  // Only digits, operators, whitespace, parentheses, decimal points
  if (!/^[\d+\-*/().\s]+$/.test(trimmed)) {
    return null;
  }

  try {
    const result = evaluateExpression(trimmed);
    if (result === null || !Number.isFinite(result)) {
      return null;
    }
    return result;
  } catch {
    return null;
  }
}

/** Round a score to a sensible display precision. */
export function normalizeScorePoints(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/** True when value is a finite score within [0, max]. */
export function isScorePointsInRange(value: number, max: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= Math.max(0, max);
}

/** Clamp a score into [0, max], rounding to a sensible display precision. */
export function clampScorePoints(value: number, max: number): number {
  const capped = Math.min(Math.max(value, 0), Math.max(0, max));
  return normalizeScorePoints(capped);
}

/**
 * Recursive-descent parser for + - * / and parentheses.
 * No exponentiation / function calls — intentionally limited for grade entry.
 */
function evaluateExpression(input: string): number | null {
  let index = 0;

  function peek(): string | undefined {
    return input[index];
  }

  function consume(): string | undefined {
    const ch = input[index];
    index += 1;
    return ch;
  }

  function skipWs(): void {
    while (peek() === " " || peek() === "\t") {
      consume();
    }
  }

  function parseNumber(): number | null {
    skipWs();
    let start = index;
    if (peek() === "+" || peek() === "-") {
      // unary only at start of a number token after operator already handled via factor
      if (start === index) {
        // handled in parseFactor
      }
    }
    if (peek() === ".") {
      // leading decimal
    }
    while (peek() !== undefined && /[0-9.]/.test(peek()!)) {
      consume();
    }
    const token = input.slice(start, index);
    if (token === "" || token === "." || token === "+" || token === "-") {
      return null;
    }
    if ((token.match(/\./g) ?? []).length > 1) {
      return null;
    }
    const n = Number(token);
    return Number.isFinite(n) ? n : null;
  }

  function parseFactor(): number | null {
    skipWs();
    const ch = peek();
    if (ch === "+") {
      consume();
      return parseFactor();
    }
    if (ch === "-") {
      consume();
      const value = parseFactor();
      return value === null ? null : -value;
    }
    if (ch === "(") {
      consume();
      const value = parseExpr();
      skipWs();
      if (peek() !== ")") {
        return null;
      }
      consume();
      return value;
    }
    return parseNumber();
  }

  function parseTerm(): number | null {
    let left = parseFactor();
    if (left === null) return null;
    for (;;) {
      skipWs();
      const op = peek();
      if (op !== "*" && op !== "/") {
        break;
      }
      consume();
      const right = parseFactor();
      if (right === null) return null;
      left = op === "*" ? left * right : left / right;
    }
    return left;
  }

  function parseExpr(): number | null {
    let left = parseTerm();
    if (left === null) return null;
    for (;;) {
      skipWs();
      const op = peek();
      if (op !== "+" && op !== "-") {
        break;
      }
      consume();
      const right = parseTerm();
      if (right === null) return null;
      left = op === "+" ? left + right : left - right;
    }
    return left;
  }

  const value = parseExpr();
  skipWs();
  if (index !== input.length) {
    return null;
  }
  return value;
}
