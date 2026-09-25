import type { IPlatformAdapter, PlatformCallbacks, PlatformMetadata } from "../types";

declare global {
  interface Window {
    CrazyGames?: {
      SDK?: {
        init: () => Promise<void>;
        game: {
          loadingStart: () => void;
          loadingStop: () => void;
          gameplayStart: () => void;
          gameplayStop: () => void;
        };
        data?: {
          getItem: (key: string) => Promise<string | null>;
          setItem: (key: string, value: string) => Promise<void>;
        };
      };
    };
  }
}

const STORAGE_KEY = "soundscape_crazygames_save_v1";

export class CrazyGamesAdapter implements IPlatformAdapter {
  readonly id = "crazygames";
  readonly metadata: PlatformMetadata = {
    id: "crazygames",
    name: "CrazyGames",
    badge: "CrazyGames",
    sdkName: "CrazyGames SDK v3",
    description: "Official CrazyGames HTML5 web gaming SDK.",
    features: {
      cloudSave: true,
      socialShare: false,
    },
  };

  detect(): boolean {
    return typeof window !== "undefined" && typeof window.CrazyGames?.SDK !== "undefined";
  }

  async initialize(_callbacks: PlatformCallbacks): Promise<() => void> {
    if (typeof window !== "undefined" && window.CrazyGames?.SDK) {
      try {
        await window.CrazyGames.SDK.init();
      } catch (err) {
        console.warn("[CrazyGames] Init fallback:", err);
      }
    }
    return () => undefined;
  }

  firstFrameReady(): void {
    // loadingStop handles this
  }

  gameReady(): void {
    if (typeof window !== "undefined" && window.CrazyGames?.SDK?.game) {
      try {
        window.CrazyGames.SDK.game.loadingStop();
        window.CrazyGames.SDK.game.gameplayStart();
      } catch {
        /* best effort */
      }
    }
  }

  isAudioMuted(): boolean {
    return false;
  }

  async loadData(): Promise<string> {
    if (typeof window !== "undefined" && window.CrazyGames?.SDK?.data?.getItem) {
      try {
        const val = await window.CrazyGames.SDK.data.getItem(STORAGE_KEY);
        if (val) return val;
      } catch {
        /* fallback */
      }
    }
    return typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) || "" : "";
  }

  async saveData(data: string): Promise<boolean> {
    if (typeof window !== "undefined" && window.CrazyGames?.SDK?.data?.setItem) {
      try {
        await window.CrazyGames.SDK.data.setItem(STORAGE_KEY, data);
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
    return typeof navigator !== "undefined" ? navigator.language : "en";
  }
}
