import type { IPlatformAdapter, PlatformCallbacks, PlatformMetadata } from "../types";

declare global {
  interface Window {
    jioGames?: unknown;
  }
}

const STORAGE_KEY = "soundscape_jiogames_save_v1";

export class JioGamesAdapter implements IPlatformAdapter {
  readonly id = "jiogames";
  readonly metadata: PlatformMetadata = {
    id: "jiogames",
    name: "JioGames",
    badge: "JioGames",
    sdkName: "JioGames SDK",
    description: "Reliance JioGames HTML5 gaming environment.",
    features: {
      cloudSave: true,
      socialShare: false,
    },
  };

  detect(): boolean {
    return typeof window !== "undefined" && typeof window.jioGames !== "undefined";
  }

  async initialize(_callbacks: PlatformCallbacks): Promise<() => void> {
    return () => undefined;
  }

  firstFrameReady(): void {}

  gameReady(): void {}

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
