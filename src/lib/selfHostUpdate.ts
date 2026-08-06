import { APP_CONFIG } from "@/config/app";
import { readViteEnv } from "@/lib/runtimeEnv";

type GithubReleaseLatest = {
  tag_name?: string;
};

function parseGithubRepo(url: string): { owner: string; repo: string } | null {
  const match = url.match(/github\.com\/([^/]+)\/([^/#]+)/i);
  if (!match) {
    return null;
  }
  return { owner: match[1], repo: match[2].replace(/\.git$/i, "") };
}

/** Strip optional leading `v` and normalize empty/placeholder versions. */
export function normalizeSemver(version: string | undefined | null): string | null {
  if (!version) {
    return null;
  }
  const trimmed = version.trim().replace(/^v/i, "");
  if (!trimmed || trimmed === "0.0.0" || trimmed === "docker") {
    return null;
  }
  return trimmed;
}

/**
 * Resolve the running self-host version the same way Docker does:
 * prefer an explicit APP_VERSION / build-arg; otherwise use a git tag
 * (`v1.2.3` or `1.2.3`). Placeholders (`0.0.0`, empty) are ignored.
 */
export function resolveSelfHostVersion(
  explicit: string | null | undefined,
  gitTag: string | null | undefined,
): string | null {
  return normalizeSemver(explicit) ?? normalizeSemver(gitTag);
}

type SemverParts = {
  major: number;
  minor: number;
  patch: number;
};

function parseSemver(version: string): SemverParts | null {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/);
  if (!match) {
    return null;
  }
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

/** True when `remote` is a strictly newer semver than `current`. */
export function isNewerSemver(remote: string, current: string): boolean {
  const a = parseSemver(remote);
  const b = parseSemver(current);
  if (!a || !b) {
    return false;
  }
  if (a.major !== b.major) {
    return a.major > b.major;
  }
  if (a.minor !== b.minor) {
    return a.minor > b.minor;
  }
  return a.patch > b.patch;
}

export function getSelfHostAppVersion(): string | null {
  return normalizeSemver(readViteEnv("VITE_APP_VERSION"));
}

export function selfHostUpgradeDocsUrl(): string {
  const base = APP_CONFIG.selfHostUrl;
  try {
    const url = new URL(base);
    url.hash = "upgrading";
    return url.toString();
  } catch {
    return `${base}#upgrading`;
  }
}

/** Fetch latest GitHub release tag for APP_CONFIG.github. Returns null on any failure. */
export async function fetchLatestReleaseVersion(): Promise<string | null> {
  const repo = parseGithubRepo(APP_CONFIG.github);
  if (!repo) {
    return null;
  }

  try {
    const response = await fetch(
      `https://api.github.com/repos/${repo.owner}/${repo.repo}/releases/latest`,
      {
        headers: {
          Accept: "application/vnd.github+json",
        },
      },
    );
    if (!response.ok) {
      return null;
    }
    const data = (await response.json()) as GithubReleaseLatest;
    return normalizeSemver(data.tag_name ?? null);
  } catch {
    return null;
  }
}
