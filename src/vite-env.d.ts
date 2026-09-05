/// <reference types="vite/client" />

interface YTGameSDK {
  IN_PLAYABLES_ENV: boolean;
  game: { firstFrameReady: () => void; gameReady: () => void; loadData: () => Promise<string>; saveData: (data: string) => Promise<void> };
  system: {
    getLanguage: () => Promise<string>;
    isAudioEnabled: () => boolean;
    onAudioEnabledChange: (callback: (isEnabled: boolean) => void) => () => void;
    onPause: (callback: () => void) => () => void;
    onResume: (callback: () => void) => () => void;
  };
  health?: { logError: () => void; logWarning: () => void };
}

interface Window { ytgame?: YTGameSDK; }
declare const ytgame: YTGameSDK | undefined;
