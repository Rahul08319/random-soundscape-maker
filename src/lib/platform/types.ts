export type PlatformId =
  | "youtube"
  | "facebook"
  | "poki"
  | "crazygames"
  | "yandex"
  | "gamedistribution"
  | "discord"
  | "jiogames"
  | "y8"
  | "lagged"
  | "microsoft"
  | "quickgames"
  | "msn_reddit"
  | "standalone";

export interface PlatformMetadata {
  id: PlatformId;
  name: string;
  badge: string;
  sdkName: string;
  description: string;
  features: {
    cloudSave: boolean;
    socialShare: boolean;
  };
}

export interface PlatformCallbacks {
  onAudioMutedChange: (isMuted: boolean) => void;
  onPause: () => void;
  onResume: () => void;
  onLanguage?: (lang: string) => void;
}

export interface IPlatformAdapter {
  readonly id: PlatformId;
  readonly metadata: PlatformMetadata;

  /** Detect if running natively in this platform's environment */
  detect(): boolean;

  /** Initialize the platform SDK */
  initialize(callbacks: PlatformCallbacks): Promise<() => void>;

  /** Signal that first frame rendered */
  firstFrameReady(): void;

  /** Signal that game is interactive and loading is finished */
  gameReady(): void;

  /** Check if audio is currently muted by platform */
  isAudioMuted(): boolean;

  /** Load saved player data */
  loadData(): Promise<string>;

  /** Save serialized player data */
  saveData(data: string): Promise<boolean>;

  /** Open external content (video or store) */
  openContent(id: string): Promise<boolean>;

  /** Retrieve user locale (BCP-47) */
  getLanguage(): Promise<string>;
}
