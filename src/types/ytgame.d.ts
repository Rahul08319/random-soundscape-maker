/**
 * YouTube Playables Web SDK Type Definitions (v1)
 * Reference: https://developers.google.com/youtube/gaming/playables/reference/sdk
 */

export declare namespace ytgame {
  export const IN_PLAYABLES_ENV: boolean;
  export const SDK_VERSION: string;

  export enum SdkErrorType {
    API_UNAVAILABLE = "API_UNAVAILABLE",
    INVALID_PARAMS = "INVALID_PARAMS",
    SIZE_LIMIT_EXCEEDED = "SIZE_LIMIT_EXCEEDED",
    UNKNOWN = "UNKNOWN",
  }

  export class SdkError extends Error {
    errorType: SdkErrorType;
    constructor(errorType: SdkErrorType, message?: string);
  }

  export namespace engagement {
    export enum ContentType {
      PLAYABLE = "PLAYABLE",
      VIDEO = "VIDEO",
    }

    export interface Content {
      id: string;
      contentType?: ContentType;
    }

    /**
     * Requests YouTube to open content (video or playable) corresponding to the ID.
     */
    export function openYTContent(content: Content): Promise<void>;

  }

  export namespace game {
    /**
     * Notifies YouTube that the game has begun rendering frames.
     * MUST be called before gameReady().
     */
    export function firstFrameReady(): void;

    /**
     * Notifies YouTube that the game is interactable (loading screen dismissed).
     */
    export function gameReady(): void;

    /**
     * Loads saved game data from YouTube cloud storage as a serialized string.
     */
    export function loadData(): Promise<string>;

    /**
     * Saves serialized game data to YouTube cloud storage.
     * Must be a valid well-formed UTF-16 string <= 3 MiB.
     */
    export function saveData(data: string): Promise<void>;
  }

  export namespace health {
    /**
     * Logs an error to YouTube diagnostics. Rate-limited and best-effort.
     */
    export function logError(): void;

    /**
     * Logs a warning to YouTube diagnostics. Rate-limited and best-effort.
     */
    export function logWarning(): void;
  }

  export namespace system {
    /**
     * Returns the user's language setting as a BCP-47 language tag (e.g. "en-US").
     */
    export function getLanguage(): Promise<string>;

    /**
     * Returns whether game audio is currently enabled in YouTube player settings.
     */
    export function isAudioEnabled(): boolean;

    /**
     * Sets a callback for when YouTube audio settings change.
     * @returns Unsubscribe function.
     */
    export function onAudioEnabledChange(callback: (isAudioEnabled: boolean) => void): () => void;

    /**
     * Sets a callback when the game is paused (e.g. tab switch or exit).
     * You have a short window to save state.
     * @returns Unsubscribe function.
     */
    export function onPause(callback: () => void): () => void;

    /**
     * Sets a callback when the game resumes from pause.
     * @returns Unsubscribe function.
     */
    export function onResume(callback: () => void): () => void;
  }
}

declare global {
  interface Window {
    ytgame?: typeof ytgame;
  }

  const ytgame: typeof ytgame | undefined;
}
