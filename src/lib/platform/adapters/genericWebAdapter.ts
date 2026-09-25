import type { IPlatformAdapter, PlatformCallbacks, PlatformId, PlatformMetadata } from "../types";

export const GENERIC_METADATA: Record<string, PlatformMetadata> = {
  y8: {
    id: "y8",
    name: "Y8 Games",
    badge: "Y8",
    sdkName: "Y8 Account & Ads API",
    description: "Y8.com global flash & HTML5 gaming portal.",
    features: {
      cloudSave: true,
      socialShare: false,
    },
  },
  lagged: {
    id: "lagged",
    name: "Lagged",
    badge: "Lagged",
    sdkName: "Lagged Game API",
    description: "Lagged.com web gaming platform runtime.",
    features: {
      cloudSave: true,
      socialShare: false,
    },
  },
  microsoft: {
    id: "microsoft",
    name: "Microsoft Store (PWA)",
    badge: "Microsoft",
    sdkName: "Windows App Runtime PWA",
    description: "Installable Progressive Web App for Microsoft Windows Store.",
    features: {
      cloudSave: true,
      socialShare: true,
    },
  },
  quickgames: {
    id: "quickgames",
    name: "Huawei & Xiaomi Quick Games",
    badge: "QuickGame",
    sdkName: "qg Quick Game API",
    description: "Instant execution runtime on Huawei & Xiaomi mobile OS.",
    features: {
      cloudSave: true,
      socialShare: false,
    },
  },
  msn_reddit: {
    id: "msn_reddit",
    name: "MSN & Reddit Games",
    badge: "MSN / Reddit",
    sdkName: "Web Embed Standard",
    description: "Embedded canvas experiences across MSN Gaming and Reddit games.",
    features: {
      cloudSave: true,
      socialShare: true,
    },
  },
  standalone: {
    id: "standalone",
    name: "Web / Standalone",
    badge: "Web",
    sdkName: "Web Audio API",
    description: "Modern desktop & mobile web browser runtime.",
    features: {
      cloudSave: true,
      socialShare: true,
    },
  },
};

export class GenericWebAdapter implements IPlatformAdapter {
  readonly id: PlatformId;
  readonly metadata: PlatformMetadata;
  private storageKey: string;

  constructor(id: PlatformId) {
    this.id = id;
    this.metadata = GENERIC_METADATA[id] || GENERIC_METADATA.standalone;
    this.storageKey = `soundscape_${id}_save_v1`;
  }

  detect(): boolean {
    if (typeof window === "undefined") return false;

    // Detect Microsoft PWA window
    if (this.id === "microsoft") {
      return (
        window.matchMedia("(display-mode: standalone)").matches ||
        (typeof navigator !== "undefined" && "userAgent" in navigator && navigator.userAgent.includes("MSStore"))
      );
    }

    // Detect Quick Games
    if (this.id === "quickgames") {
      return typeof (window as unknown as { qg?: unknown }).qg !== "undefined";
    }

    // Detect MSN or Reddit referrer/container
    if (this.id === "msn_reddit") {
      const href = window.location.href;
      const ref = document.referrer;
      return href.includes("msn.com") || href.includes("reddit.com") || ref.includes("reddit.com");
    }

    // Standalone fallback
    if (this.id === "standalone") return true;

    return false;
  }

  async initialize(callbacks: PlatformCallbacks): Promise<() => void> {
    if (callbacks.onLanguage && typeof navigator !== "undefined") {
      callbacks.onLanguage(navigator.language);
    }
    return () => undefined;
  }

  firstFrameReady(): void {}

  gameReady(): void {}

  isAudioMuted(): boolean {
    return false;
  }

  async loadData(): Promise<string> {
    try {
      return window.localStorage.getItem(this.storageKey) || "";
    } catch {
      return "";
    }
  }

  async saveData(data: string): Promise<boolean> {
    try {
      window.localStorage.setItem(this.storageKey, data);
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
