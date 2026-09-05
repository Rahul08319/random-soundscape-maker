const STORAGE_KEY = "random-soundscape-maker.playables-save.v1";

function getSdk() {
  if (typeof window === "undefined") return undefined;
  return window.ytgame ?? (typeof ytgame !== "undefined" ? ytgame : undefined);
}

export function reportPlayableWarning() {
  try { getSdk()?.health?.logWarning(); } catch { /* best effort */ }
}

export function reportPlayableError() {
  try { getSdk()?.health?.logError(); } catch { /* best effort */ }
}

export async function loadPlayableData() {
  const sdk = getSdk();
  if (sdk?.IN_PLAYABLES_ENV) {
    try { return await sdk.game.loadData(); } catch { reportPlayableWarning(); }
  }
  try { return window.localStorage.getItem(STORAGE_KEY) ?? ""; } catch { return ""; }
}

export async function savePlayableData(data: string) {
  const sdk = getSdk();
  try {
    if (sdk?.IN_PLAYABLES_ENV) { await sdk.game.saveData(data); return; }
    window.localStorage.setItem(STORAGE_KEY, data);
  } catch { reportPlayableWarning(); }
}

interface PlayablesCallbacks {
  onAudioEnabledChange: (isEnabled: boolean) => void;
  onPause: () => void;
  onResume: () => void;
  onLanguage: (language: string) => void;
}

export async function initializePlayables(callbacks: PlayablesCallbacks) {
  const sdk = getSdk();
  if (!sdk) return () => undefined;
  try { sdk.game.firstFrameReady(); } catch { reportPlayableError(); }
  try { callbacks.onAudioEnabledChange(sdk.system.isAudioEnabled()); } catch { reportPlayableWarning(); }
  const cleanup = [
    sdk.system.onAudioEnabledChange(callbacks.onAudioEnabledChange),
    sdk.system.onPause(callbacks.onPause),
    sdk.system.onResume(callbacks.onResume),
  ];
  try { callbacks.onLanguage(await sdk.system.getLanguage()); } catch { reportPlayableWarning(); }
  return () => cleanup.forEach((unsubscribe) => unsubscribe());
}

export function markPlayableReady() {
  try { getSdk()?.game.gameReady(); } catch { reportPlayableError(); }
}
