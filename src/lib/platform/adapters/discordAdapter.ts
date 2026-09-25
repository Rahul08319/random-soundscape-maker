import type { IPlatformAdapter, PlatformCallbacks, PlatformMetadata } from "../types";

declare global {
  interface Window {
    DiscordSDK?: unknown;
  }
}

const STORAGE_KEY = "soundscape_discord_save_v1";

export class DiscordActivitiesAdapter implements IPlatformAdapter {
  readonly id = "discord";
  readonly metadata: PlatformMetadata = {
    id: "discord",
    name: "Discord Activities",
    badge: "Discord",
    sdkName: "Discord Embedded App SDK",
    description: "Discord Voice Channel Activities interactive runtime.",
    features: {
      cloudSave: true,
      socialShare: true,
    },
  };

  detect(): boolean {
    if (typeof window === "undefined") return false;
    return (
      Boolean(window.DiscordSDK) ||
      window.location.search.includes("frame_id") ||
      window.location.search.includes("instance_id")
    );
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
