import type { IPlatformAdapter, PlatformCallbacks, PlatformMetadata } from "../types";
import {
  getPlayablesSdk,
  initializePlayables,
  isInPlayablesEnv,
  loadPlayableData,
  markPlayableReady,
  openPlayableContent,
  requestPlayableInterstitial,
  requestPlayableReward,
  savePlayableData,
  sendPlayableScore,
} from "../../youtubePlayables";

export class YouTubePlayablesAdapter implements IPlatformAdapter {
  readonly id = "youtube";
  readonly metadata: PlatformMetadata = {
    id: "youtube",
    name: "YouTube Playables",
    badge: "YouTube",
    sdkName: "ytgame SDK v1",
    description: "Official Google YouTube Playables web SDK integration.",
    features: {
      cloudSave: true,
      rewardedAds: true,
      interstitialAds: true,
      leaderboards: true,
      socialShare: true,
    },
  };

  detect(): boolean {
    return isInPlayablesEnv();
  }

  async initialize(callbacks: PlatformCallbacks): Promise<() => void> {
    return await initializePlayables({
      onAudioEnabledChange: (isEnabled) => callbacks.onAudioMutedChange(!isEnabled),
      onPause: callbacks.onPause,
      onResume: callbacks.onResume,
      onLanguage: callbacks.onLanguage,
    });
  }

  firstFrameReady(): void {
    const sdk = getPlayablesSdk();
    try {
      sdk?.game?.firstFrameReady();
    } catch {
      /* Best effort */
    }
  }

  gameReady(): void {
    markPlayableReady();
  }

  isAudioMuted(): boolean {
    // Only mute if actively inside the YouTube Playables environment and reported disabled
    if (!isInPlayablesEnv()) return false;
    try {
      const sdk = getPlayablesSdk();
      return sdk?.system ? !sdk.system.isAudioEnabled() : false;
    } catch {
      return false;
    }
  }

  async requestInterstitial(): Promise<boolean> {
    return await requestPlayableInterstitial();
  }

  async requestReward(rewardId: string): Promise<boolean> {
    return await requestPlayableReward(rewardId);
  }

  async loadData(): Promise<string> {
    return await loadPlayableData();
  }

  async saveData(data: string): Promise<boolean> {
    return await savePlayableData(data);
  }

  async sendScore(score: number): Promise<boolean> {
    return await sendPlayableScore(score);
  }

  async openContent(id: string): Promise<boolean> {
    return await openPlayableContent(id, "VIDEO");
  }

  async getLanguage(): Promise<string> {
    try {
      const sdk = getPlayablesSdk();
      if (sdk?.system?.getLanguage) {
        return await sdk.system.getLanguage();
      }
    } catch {
      /* fallback */
    }
    return typeof navigator !== "undefined" ? navigator.language : "en";
  }
}
