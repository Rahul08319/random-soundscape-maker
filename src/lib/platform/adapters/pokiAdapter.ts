import type { IPlatformAdapter, PlatformCallbacks, PlatformMetadata } from "../types";

declare global {
  interface Window {
    PokiSDK?: {
      init: () => Promise<void>;
      gameLoadingFinished: () => void;
      gameplayStart: () => void;
      gameplayStop: () => void;
      setDebug?: (debug: boolean) => void;
    };
  }
}

const STORAGE_KEY = "soundscape_poki_save_v1";

export class PokiAdapter implements IPlatformAdapter {
  readonly id = "poki";
  readonly metadata: PlatformMetadata = {
    id: "poki",
    name: "Poki",
    badge: "Poki",
    sdkName: "Poki SDK v2",
    description: "Official Poki web gaming SDK integration.",
    features: {
      cloudSave: true,
      socialShare: false,
    },
  };

  detect(): boolean {
    return typeof window !== "undefined" && typeof window.PokiSDK !== "undefined";
  }

  async initialize(_callbacks: PlatformCallbacks): Promise<() => void> {
    if (typeof window !== "undefined" && window.PokiSDK) {
      try {
        await window.PokiSDK.init();
      } catch (err) {
        console.warn("[PokiSDK] Init fallback:", err);
      }
    }
    return () => undefined;
  }

  firstFrameReady(): void {
    // Poki uses gameLoadingFinished
  }

  gameReady(): void {
    if (typeof window !== "undefined" && window.PokiSDK) {
      try {
        window.PokiSDK.gameLoadingFinished();
        window.PokiSDK.gameplayStart();
      } catch {
        /* best effort */
      }
    }
  }

  isAudioMuted(): boolean {
    return false;
  }

  async loadData(): Promise<string> {
    return typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) || "" : "";
  }

  async saveData(data: string): Promise<boolean> {
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
    return typeof navigator !== "undefined" ? navigator.language : "en";
  }
}
