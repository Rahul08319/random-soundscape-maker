import type { IPlatformAdapter, PlatformCallbacks, PlatformMetadata } from "../types";

declare global {
  interface Window {
    jioGames?: {
      postScore?: (score: number) => void;
      showAd?: (type: string, cb?: () => void) => void;
    };
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
      rewardedAds: true,
      interstitialAds: true,
      leaderboards: true,
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

  async requestInterstitial(): Promise<boolean> {
    if (typeof window !== "undefined" && window.jioGames?.showAd) {
      window.jioGames.showAd("interstitial");
      return true;
    }
    return true;
  }

  async requestReward(_rewardId: string): Promise<boolean> {
    if (typeof window !== "undefined" && window.jioGames?.showAd) {
      window.jioGames.showAd("rewarded");
      return true;
    }
    return true;
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

  async sendScore(score: number): Promise<boolean> {
    if (typeof window !== "undefined" && window.jioGames?.postScore) {
      window.jioGames.postScore(score);
    }
    return true;
  }

  async openContent(_id: string): Promise<boolean> {
    return false;
  }

  async getLanguage(): Promise<string> {
    return typeof navigator !== "undefined" ? navigator.language : "en";
  }
}
