import type { IPlatformAdapter, PlatformCallbacks, PlatformMetadata } from "../types";

declare global {
  interface Window {
    YaGames?: {
      init: () => Promise<YandexSDK>;
    };
  }
}

interface YandexSDK {
  features?: {
    LoadingAPI?: {
      ready: () => void;
    };
  };
  getPlayer?: () => Promise<{
    getData: (keys: string[]) => Promise<Record<string, string>>;
    setData: (data: Record<string, string>) => Promise<void>;
  }>;
  environment?: {
    i18n?: {
      lang?: string;
    };
  };
}

const STORAGE_KEY = "soundscape_yandex_save_v1";

export class YandexGamesAdapter implements IPlatformAdapter {
  readonly id = "yandex";
  readonly metadata: PlatformMetadata = {
    id: "yandex",
    name: "Yandex Games",
    badge: "Yandex",
    sdkName: "YaGames SDK v2",
    description: "Yandex Games HTML5 platform SDK.",
    features: {
      cloudSave: true,
      socialShare: true,
    },
  };

  private ysdk: YandexSDK | null = null;

  detect(): boolean {
    return typeof window !== "undefined" && typeof window.YaGames !== "undefined";
  }

  async initialize(callbacks: PlatformCallbacks): Promise<() => void> {
    if (typeof window !== "undefined" && window.YaGames) {
      try {
        this.ysdk = await window.YaGames.init();
        if (this.ysdk.environment?.i18n?.lang && callbacks.onLanguage) {
          callbacks.onLanguage(this.ysdk.environment.i18n.lang);
        }
      } catch (err) {
        console.warn("[Yandex] Init fallback:", err);
      }
    }
    return () => undefined;
  }

  firstFrameReady(): void {
    // handled on gameReady
  }

  gameReady(): void {
    if (this.ysdk?.features?.LoadingAPI?.ready) {
      this.ysdk.features.LoadingAPI.ready();
    }
  }

  isAudioMuted(): boolean {
    return false;
  }

  async loadData(): Promise<string> {
    if (this.ysdk?.getPlayer) {
      try {
        const player = await this.ysdk.getPlayer();
        const data = await player.getData([STORAGE_KEY]);
        return data[STORAGE_KEY] || "";
      } catch {
        /* fallback */
      }
    }
    return typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) || "" : "";
  }

  async saveData(data: string): Promise<boolean> {
    if (this.ysdk?.getPlayer) {
      try {
        const player = await this.ysdk.getPlayer();
        await player.setData({ [STORAGE_KEY]: data });
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
    return this.ysdk?.environment?.i18n?.lang || (typeof navigator !== "undefined" ? navigator.language : "en");
  }
}
