import type { IPlatformAdapter, PlatformCallbacks, PlatformId, PlatformMetadata } from "./types";
import { YouTubePlayablesAdapter } from "./adapters/youtubeAdapter";
import { FacebookInstantAdapter } from "./adapters/facebookAdapter";
import { PokiAdapter } from "./adapters/pokiAdapter";
import { CrazyGamesAdapter } from "./adapters/crazyGamesAdapter";
import { YandexGamesAdapter } from "./adapters/yandexAdapter";
import { GameDistributionAdapter } from "./adapters/gameDistributionAdapter";
import { DiscordActivitiesAdapter } from "./adapters/discordAdapter";
import { JioGamesAdapter } from "./adapters/jioGamesAdapter";
import { GenericWebAdapter, GENERIC_METADATA } from "./adapters/genericWebAdapter";

export const SUPPORTED_PLATFORMS: PlatformMetadata[] = [
  new YouTubePlayablesAdapter().metadata,
  new FacebookInstantAdapter().metadata,
  new PokiAdapter().metadata,
  new CrazyGamesAdapter().metadata,
  new YandexGamesAdapter().metadata,
  new GameDistributionAdapter().metadata,
  new DiscordActivitiesAdapter().metadata,
  new JioGamesAdapter().metadata,
  GENERIC_METADATA.y8,
  GENERIC_METADATA.lagged,
  GENERIC_METADATA.microsoft,
  GENERIC_METADATA.quickgames,
  GENERIC_METADATA.msn_reddit,
  GENERIC_METADATA.standalone,
];

class UnifiedPlatformManager {
  private activeAdapter: IPlatformAdapter;
  private adapters: Map<PlatformId, IPlatformAdapter> = new Map();
  private callbacks: PlatformCallbacks | null = null;
  private cleanupFn: (() => void) | null = null;

  constructor() {
    // Register all native adapters (zero external SDK dependencies like Playgama)
    this.register(new YouTubePlayablesAdapter());
    this.register(new FacebookInstantAdapter());
    this.register(new PokiAdapter());
    this.register(new CrazyGamesAdapter());
    this.register(new YandexGamesAdapter());
    this.register(new GameDistributionAdapter());
    this.register(new DiscordActivitiesAdapter());
    this.register(new JioGamesAdapter());
    this.register(new GenericWebAdapter("y8"));
    this.register(new GenericWebAdapter("lagged"));
    this.register(new GenericWebAdapter("microsoft"));
    this.register(new GenericWebAdapter("quickgames"));
    this.register(new GenericWebAdapter("msn_reddit"));
    this.register(new GenericWebAdapter("standalone"));

    // Detect environment on launch
    this.activeAdapter = this.detectPlatform();
  }

  private register(adapter: IPlatformAdapter): void {
    this.adapters.set(adapter.id, adapter);
  }

  /**
   * Automatically detects the host platform from query parameters, window environment, or host.
   */
  private detectPlatform(): IPlatformAdapter {
    if (typeof window !== "undefined") {
      // 1. Check explicit URL query override (?platform=poki, ?platform=facebook, etc.)
      const params = new URLSearchParams(window.location.search);
      const forced = params.get("platform") as PlatformId | null;
      if (forced && this.adapters.has(forced)) {
        return this.adapters.get(forced)!;
      }

      // 2. Check each adapter's native detection
      for (const adapter of this.adapters.values()) {
        if (adapter.id !== "standalone" && adapter.detect()) {
          return adapter;
        }
      }
    }

    // Default to standalone web
    return this.adapters.get("standalone") || new GenericWebAdapter("standalone");
  }

  public get current(): IPlatformAdapter {
    return this.activeAdapter;
  }

  public get currentId(): PlatformId {
    return this.activeAdapter.id;
  }

  public get currentMetadata(): PlatformMetadata {
    return this.activeAdapter.metadata;
  }

  /**
   * Switches the active platform adapter on the fly (useful for developer QA & previewing platform builds)
   */
  public async switchPlatform(id: PlatformId): Promise<void> {
    const target = this.adapters.get(id);
    if (!target) return;

    if (this.cleanupFn) {
      this.cleanupFn();
      this.cleanupFn = null;
    }

    this.activeAdapter = target;
    if (this.callbacks) {
      this.cleanupFn = await this.activeAdapter.initialize(this.callbacks);
      this.activeAdapter.gameReady();
    }
  }

  public async initialize(callbacks: PlatformCallbacks): Promise<() => void> {
    this.callbacks = callbacks;
    this.cleanupFn = await this.activeAdapter.initialize(callbacks);
    return () => {
      if (this.cleanupFn) {
        this.cleanupFn();
        this.cleanupFn = null;
      }
    };
  }

  public firstFrameReady(): void {
    this.activeAdapter.firstFrameReady();
  }

  public gameReady(): void {
    this.activeAdapter.gameReady();
  }

  public isAudioMuted(): boolean {
    return this.activeAdapter.isAudioMuted();
  }

  public async requestInterstitial(): Promise<boolean> {
    return await this.activeAdapter.requestInterstitial();
  }

  public async requestReward(rewardId: string): Promise<boolean> {
    return await this.activeAdapter.requestReward(rewardId);
  }

  public async loadData(): Promise<string> {
    return await this.activeAdapter.loadData();
  }

  public async saveData(data: string): Promise<boolean> {
    return await this.activeAdapter.saveData(data);
  }

  public async sendScore(score: number): Promise<boolean> {
    return await this.activeAdapter.sendScore(score);
  }

  public async openContent(id: string): Promise<boolean> {
    return await this.activeAdapter.openContent(id);
  }

  public async getLanguage(): Promise<string> {
    return await this.activeAdapter.getLanguage();
  }
}

export const platformManager = new UnifiedPlatformManager();
