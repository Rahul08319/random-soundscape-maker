import type { IPlatformAdapter, PlatformCallbacks, PlatformMetadata } from "../types";

declare global {
  interface Window {
    gdsdk?: {
      showAd: (adType?: "interstitial" | "rewarded") => Promise<void>;
      preloadAd?: (adType?: "rewarded") => Promise<void>;
    };
  }
}

const STORAGE_KEY = "soundscape_gd_save_v1";

export class GameDistributionAdapter implements IPlatformAdapter {
  readonly id = "gamedistribution";
  readonly metadata: PlatformMetadata = {
    id: "gamedistribution",
    name: "GameDistribution",
    badge: "GameDist",
    sdkName: "GameDistribution SDK",
    description: "GameDistribution global HTML5 publisher network.",
    features: {
      cloudSave: true,
      rewardedAds: true,
      interstitialAds: true,
      leaderboards: false,
      socialShare: false,
    },
  };

  detect(): boolean {
    return typeof window !== "undefined" && typeof window.gdsdk !== "undefined";
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
    if (typeof window !== "undefined" && window.gdsdk) {
      try {
        await window.gdsdk.showAd("interstitial");
        return true;
      } catch {
        return false;
      }
    }
    return true;
  }

  async requestReward(_rewardId: string): Promise<boolean> {
    if (typeof window !== "undefined" && window.gdsdk) {
      try {
        await window.gdsdk.showAd("rewarded");
        return true;
      } catch {
        return false;
      }
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

  async sendScore(_score: number): Promise<boolean> {
    return true;
  }

  async openContent(_id: string): Promise<boolean> {
    return false;
  }

  async getLanguage(): Promise<string> {
    return typeof navigator !== "undefined" ? navigator.language : "en";
  }
}
