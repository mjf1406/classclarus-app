import { useEffect, useState } from "react";

import { isElectronClassroom } from "@/lib/classroom/classroomSession";
import { isSelfHosted } from "@/lib/selfHosted";
import {
  fetchLatestReleaseVersion,
  getSelfHostAppVersion,
  isNewerSemver,
} from "@/lib/selfHostUpdate";
import { STORAGE_KEYS } from "@/lib/storageKeys";

export type SelfHostUpdateState = {
  /** Running self-host semver, or null when unavailable / not self-host. */
  currentVersion: string | null;
  /** Newer GitHub release when one exists (ignores dismiss / remind-later). */
  availableVersion: string | null;
  /** Banner visibility after permanent dismiss and session remind-later. */
  showBanner: boolean;
  /** True after the GitHub latest-release check settles (or is skipped). */
  checked: boolean;
};

function readDismissedVersion(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEYS.selfHostUpdateDismissed);
  } catch {
    return null;
  }
}

function readRemindLaterVersion(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_KEYS.selfHostUpdateRemindLater);
  } catch {
    return null;
  }
}

const idleState: SelfHostUpdateState = {
  currentVersion: null,
  availableVersion: null,
  showBanner: false,
  checked: true,
};

/**
 * Background advisory for Docker/web self-host: latest GitHub release when it's
 * newer than the version baked into the image.
 */
export function useSelfHostUpdateAvailable(): SelfHostUpdateState {
  const [state, setState] = useState<SelfHostUpdateState>(() => {
    if (!isSelfHosted() || isElectronClassroom()) {
      return idleState;
    }
    return {
      currentVersion: getSelfHostAppVersion(),
      availableVersion: null,
      showBanner: false,
      checked: false,
    };
  });

  useEffect(() => {
    if (!isSelfHosted() || isElectronClassroom()) {
      return;
    }

    const currentVersion = getSelfHostAppVersion();
    if (!currentVersion) {
      setState(idleState);
      return;
    }

    let cancelled = false;

    void (async () => {
      const remoteVersion = await fetchLatestReleaseVersion();
      if (cancelled) {
        return;
      }
      if (!remoteVersion || !isNewerSemver(remoteVersion, currentVersion)) {
        setState({
          currentVersion,
          availableVersion: null,
          showBanner: false,
          checked: true,
        });
        return;
      }

      const showBanner =
        readDismissedVersion() !== remoteVersion && readRemindLaterVersion() !== remoteVersion;

      setState({
        currentVersion,
        availableVersion: remoteVersion,
        showBanner,
        checked: true,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

/** Hide the banner for this version until the next browser session. */
export function remindLaterSelfHostUpdate(version: string): void {
  try {
    sessionStorage.setItem(STORAGE_KEYS.selfHostUpdateRemindLater, version);
  } catch {
    // ignore quota / private mode
  }
}

/** Permanently dismiss the banner for this remote version. */
export function dismissSelfHostUpdate(version: string): void {
  try {
    localStorage.setItem(STORAGE_KEYS.selfHostUpdateDismissed, version);
  } catch {
    // ignore quota / private mode
  }
}
