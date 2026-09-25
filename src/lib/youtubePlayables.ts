import type { ytgame as YtGameNamespace } from "@/types/ytgame";

const STORAGE_KEY = "random-soundscape-maker.playables-save.v1";
const MAX_DATA_BYTES = 3 * 1024 * 1024; // 3 MiB limit enforced by YouTube Playables

export function getPlayablesSdk(): typeof YtGameNamespace | undefined {
  if (typeof window === "undefined") return undefined;
  return window.ytgame ?? (typeof ytgame !== "undefined" ? ytgame : undefined);
}

export function isInPlayablesEnv(): boolean {
  const sdk = getPlayablesSdk();
  return Boolean(sdk && sdk.IN_PLAYABLES_ENV);
}

export function reportPlayableWarning(reason?: string): void {
  const sdk = getPlayablesSdk();
  if (reason && process.env.NODE_ENV !== "production") {
    console.warn("[YouTube Playables Warning]", reason);
  }
  try {
    sdk?.health?.logWarning();
  } catch {
    /* Best effort rate-limited logging */
  }
}

export function reportPlayableError(error?: unknown): void {
  const sdk = getPlayablesSdk();
  if (error && process.env.NODE_ENV !== "production") {
    console.error("[YouTube Playables Error]", error);
  }
  try {
    sdk?.health?.logError();
  } catch {
    /* Best effort rate-limited logging */
  }
}

/**
 * Validates that string is well-formed UTF-16 and under the 3 MiB limit.
 */
function isValidPayload(payload: string): boolean {
  if (typeof payload !== "string") return false;
  // Check UTF-16 well-formedness if browser supports it
  if (typeof (payload as unknown as { isWellFormed?: () => boolean }).isWellFormed === "function") {
    if (!payload.isWellFormed()) return false;
  }
  // Rough byte length check for 3 MiB limit (UTF-16 chars are 2 bytes each)
  const byteLength = payload.length * 2;
  return byteLength <= MAX_DATA_BYTES;
}

export async function loadPlayableData(): Promise<string> {
  const sdk = getPlayablesSdk();
  if (sdk?.IN_PLAYABLES_ENV) {
    try {
      const data = await sdk.game.loadData();
      return typeof data === "string" ? data : "";
    } catch (err) {
      reportPlayableWarning("Failed to load cloud save data from YouTube Playables");
    }
  }

  // Fallback to localStorage for local development or non-Playables environment
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

export async function savePlayableData(data: string): Promise<boolean> {
  if (!isValidPayload(data)) {
    reportPlayableWarning("Payload exceeds 3 MiB or is not well-formed UTF-16");
    return false;
  }

  const sdk = getPlayablesSdk();
  if (sdk?.IN_PLAYABLES_ENV) {
    try {
      await sdk.game.saveData(data);
      return true;
    } catch (err) {
      reportPlayableError(err);
      return false;
    }
  }

  // Fallback to localStorage
  try {
    window.localStorage.setItem(STORAGE_KEY, data);
    return true;
  } catch {
    return false;
  }
}

export interface PlayablesCallbacks {
  onAudioEnabledChange: (isEnabled: boolean) => void;
  onPause: () => void;
  onResume: () => void;
  onLanguage?: (language: string) => void;
}

export async function initializePlayables(callbacks: PlayablesCallbacks): Promise<() => void> {
  const sdk = getPlayablesSdk();
  if (!sdk) {
    return () => undefined;
  }

  // 1. MUST notify YouTube that game has begun rendering frames before gameReady()
  try {
    sdk.game.firstFrameReady();
  } catch (err) {
    reportPlayableError(err);
  }

  // 2. Query initial audio state safely:
  // Only honor host muting if running inside the live Playables container.
  // In local development or standalone web, the mock SDK returns false which must not silence the game.
  try {
    if (isInPlayablesEnv() && typeof sdk.system.isAudioEnabled === "function") {
      const isAudioOn = sdk.system.isAudioEnabled();
      if (typeof isAudioOn === "boolean") {
        callbacks.onAudioEnabledChange(isAudioOn);
      } else {
        callbacks.onAudioEnabledChange(true);
      }
    } else {
      callbacks.onAudioEnabledChange(true);
    }
  } catch {
    callbacks.onAudioEnabledChange(true);
  }

  // 3. Register lifecycle and audio change callbacks
  const cleanup: Array<() => void> = [];

  try {
    const unsubAudio = sdk.system.onAudioEnabledChange((enabled) => {
      callbacks.onAudioEnabledChange(enabled);
    });
    if (typeof unsubAudio === "function") cleanup.push(unsubAudio);
  } catch {
    reportPlayableWarning("Failed to register onAudioEnabledChange");
  }

  try {
    const unsubPause = sdk.system.onPause(() => {
      callbacks.onPause();
    });
    if (typeof unsubPause === "function") cleanup.push(unsubPause);
  } catch {
    reportPlayableWarning("Failed to register onPause");
  }

  try {
    const unsubResume = sdk.system.onResume(() => {
      callbacks.onResume();
    });
    if (typeof unsubResume === "function") cleanup.push(unsubResume);
  } catch {
    reportPlayableWarning("Failed to register onResume");
  }

  // 4. Retrieve user's language setting via BCP-47 tag
  if (callbacks.onLanguage) {
    try {
      const language = await sdk.system.getLanguage();
      if (language) {
        callbacks.onLanguage(language);
      }
    } catch {
      reportPlayableWarning("Failed to retrieve user language");
    }
  }

  return () => {
    cleanup.forEach((unsubscribe) => {
      try {
        unsubscribe();
      } catch {
        /* Ignore cleanup errors */
      }
    });
  };
}

export function markPlayableReady(): void {
  const sdk = getPlayablesSdk();
  if (!sdk) return;
  try {
    sdk.game.gameReady();
  } catch (err) {
    reportPlayableError(err);
  }
}

/**
 * Opens content on YouTube (e.g. soundscape demo video or related playable).
 */
export async function openPlayableContent(
  id: string,
  contentType: "VIDEO" | "PLAYABLE" = "VIDEO"
): Promise<boolean> {
  const sdk = getPlayablesSdk();
  if (sdk?.IN_PLAYABLES_ENV && sdk?.engagement?.openYTContent) {
    try {
      const typeEnum =
        contentType === "PLAYABLE"
          ? sdk.engagement.ContentType.PLAYABLE
          : sdk.engagement.ContentType.VIDEO;
      await sdk.engagement.openYTContent({ id, contentType: typeEnum });
      return true;
    } catch (err) {
      reportPlayableWarning(`Failed to open YouTube content: ${id}`);
    }
  }

  // Fallback in web/standalone mode: open YouTube in a new tab
  try {
    if (contentType === "VIDEO") {
      window.open(`https://www.youtube.com/watch?v=${id}`, "_blank", "noopener,noreferrer");
      return true;
    }
  } catch {
    /* Ignore popup blockers */
  }

  return false;
}
