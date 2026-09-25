import type { IPlatformAdapter, PlatformCallbacks, PlatformMetadata } from "../types";

declare global {
  interface Window {
    FBInstant?: {
      initializeAsync: () => Promise<void>;
      startGameAsync: () => Promise<void>;
      getLocale: () => string;
      onPause?: (cb: () => void) => void;
      player: {
        getID: () => string;
        getName: () => string;
        getDataAsync: (keys: string[]) => Promise<Record<string, string>>;
        setDataAsync: (data: Record<string, string>) => Promise<void>;
      };
    };
  }
}

const STORAGE_KEY = "soundscape_fb_save_v1";

export class FacebookInstantAdapter implements IPlatformAdapter {
  readonly id = "facebook";
  readonly metadata: PlatformMetadata = {
    id: "facebook",
    name: "Facebook Instant Games",
    badge: "Facebook",
    sdkName: "FBInstant SDK v7",
    description: "Meta Facebook Instant Games native web runtime.",
    features: {
      cloudSave: true,
      socialShare: true,
    },
  };

  detect(): boolean {
    return typeof window !== "undefined" && typeof window.FBInstant !== "undefined";
  }

  async initialize(callbacks: PlatformCallbacks): Promise<() => void> {
    if (typeof window !== "undefined" && window.FBInstant) {
      try {
        await window.FBInstant.initializeAsync();
        if (callbacks.onLanguage) {
          callbacks.onLanguage(window.FBInstant.getLocale() || "en_US");
        }
        if (window.FBInstant.onPause) {
          window.FBInstant.onPause(callbacks.onPause);
        }
      } catch (err) {
        console.warn("[FBInstant] Initialization error:", err);
      }
    }
    return () => undefined;
  }

  firstFrameReady(): void {
    // No-op on FBInstant until startGameAsync
  }

  gameReady(): void {
    if (typeof window !== "undefined" && window.FBInstant) {
      window.FBInstant.startGameAsync().catch(() => undefined);
    }
  }

  isAudioMuted(): boolean {
    return false;
  }

  async loadData(): Promise<string> {
    if (typeof window !== "undefined" && window.FBInstant?.player?.getDataAsync) {
      try {
        const res = await window.FBInstant.player.getDataAsync([STORAGE_KEY]);
        return res[STORAGE_KEY] || "";
      } catch {
        /* fallback */
      }
    }
    return typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) || "" : "";
  }

  async saveData(data: string): Promise<boolean> {
    if (typeof window !== "undefined" && window.FBInstant?.player?.setDataAsync) {
      try {
        await window.FBInstant.player.setDataAsync({ [STORAGE_KEY]: data });
        return true;
      } catch {
        /* fallback */
      }
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, data);
      return true;
    } catch {
      return false;
    }
  }

  async openContent(_id: string): Promise<boolean> {
    return false;
  }

  async getLanguage(): Promise<string> {
    if (typeof window !== "undefined" && window.FBInstant?.getLocale) {
      return window.FBInstant.getLocale();
    }
    return typeof navigator !== "undefined" ? navigator.language : "en";
  }
}
