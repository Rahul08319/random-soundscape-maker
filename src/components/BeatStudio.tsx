import { ChangeEvent, CSSProperties, useEffect, useRef, useState } from "react";
import {
  FileDown,
  Layers,
  Pause,
  Play,
  Save,
  Share2,
  Shuffle,
  SlidersHorizontal,
  Sparkles,
  Star,
  Trophy,
  Upload,
  Volume2,
  VolumeX,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SoundscapeVisualizer } from "./SoundscapeVisualizer";
import { platformManager, SUPPORTED_PLATFORMS, type PlatformId } from "@/lib/platform";

const STEPS = 16;
const MAX_PRESETS = 24;
const REWARD_VIP_ID = "reward-vip-sound-pack-1";

type Track = {
  name: string;
  color: string;
  volume: number;
  muted: boolean;
  solo: boolean;
};

type BeatState = {
  bpm: number;
  pattern: boolean[][];
  tracks: Track[];
  swing: number;
  velocity: number;
};

type Preset = {
  id: string;
  name: string;
  favorite: boolean;
  beat: BeatState;
};

type SavedStudio = Partial<BeatState> & {
  presets?: Preset[];
  grooveScore?: number;
  isVipUnlocked?: boolean;
};

const getBaseTracks = (): Track[] => [
  { name: "Kick", color: "hsl(280 85% 65%)", volume: 0.9, muted: false, solo: false },
  { name: "Snare", color: "hsl(190 85% 55%)", volume: 0.75, muted: false, solo: false },
  { name: "Hi-Hat", color: "hsl(330 85% 60%)", volume: 0.5, muted: false, solo: false },
  { name: "Clap", color: "hsl(145 80% 55%)", volume: 0.65, muted: false, solo: false },
  { name: "Bass", color: "hsl(45 95% 60%)", volume: 0.7, muted: false, solo: false },
  { name: "Shaker", color: "hsl(15 90% 65%)", volume: 0.45, muted: false, solo: false },
];

const getVipTracks = (): Track[] => [
  { name: "808 Sub", color: "hsl(300 90% 55%)", volume: 0.85, muted: false, solo: false },
  { name: "Synth Lead", color: "hsl(215 90% 60%)", volume: 0.7, muted: false, solo: false },
];

const createTracks = (isVipUnlocked = false): Track[] => {
  return isVipUnlocked ? [...getBaseTracks(), ...getVipTracks()] : getBaseTracks();
};

const emptyPattern = (trackCount = createTracks(false).length) =>
  Array.from({ length: trackCount }, () => Array(STEPS).fill(false));

const starterPattern = (trackCount = 6) => {
  const pattern = emptyPattern(trackCount);
  [0, 4, 8, 12].forEach((step) => {
    pattern[0][step] = true;
    if (trackCount > 4) pattern[4][step] = true;
  });
  [4, 12].forEach((step) => {
    pattern[1][step] = true;
  });
  [0, 2, 4, 6, 8, 10, 12, 14].forEach((step) => {
    pattern[2][step] = true;
  });
  [6, 14].forEach((step) => {
    pattern[3][step] = true;
  });
  if (trackCount > 5) {
    [3, 7, 11, 15].forEach((step) => {
      pattern[5][step] = true;
    });
  }
  if (trackCount > 6) {
    [0, 8].forEach((step) => {
      pattern[6][step] = true;
    });
  }
  if (trackCount > 7) {
    [2, 6, 10, 14].forEach((step) => {
      pattern[7][step] = true;
    });
  }
  return pattern;
};

const cloneBeat = (beat: BeatState): BeatState => ({
  ...beat,
  pattern: beat.pattern.map((row) => [...row]),
  tracks: beat.tracks.map((track) => ({ ...track })),
});

function validBeat(value: unknown, isVipUnlocked = false): BeatState | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as SavedStudio;
  const defaults = createTracks(isVipUnlocked);
  const targetCount = defaults.length;

  let pattern: boolean[][] | null = null;
  if (Array.isArray(candidate.pattern) && candidate.pattern.length >= 4) {
    const rows = candidate.pattern.map((row) =>
      Array.isArray(row) && row.length === STEPS ? row.map(Boolean) : Array(STEPS).fill(false)
    );
    if (rows.length < targetCount) {
      pattern = [...rows, ...emptyPattern(targetCount - rows.length)];
    } else {
      pattern = rows.slice(0, targetCount);
    }
  }

  if (!pattern) return null;

  return {
    bpm:
      typeof candidate.bpm === "number" && candidate.bpm >= 60 && candidate.bpm <= 200
        ? candidate.bpm
        : 120,
    pattern,
    tracks:
      Array.isArray(candidate.tracks) && candidate.tracks.length > 0
        ? defaults.map((fallback, idx) => {
            const found = candidate.tracks?.[idx];
            if (!found) return fallback;
            return {
              ...fallback,
              volume: Math.min(1, Math.max(0, Number(found.volume) || fallback.volume)),
              muted: Boolean(found.muted),
              solo: Boolean(found.solo),
            };
          })
        : defaults,
    swing: typeof candidate.swing === "number" ? Math.min(50, Math.max(0, candidate.swing)) : 0,
    velocity:
      typeof candidate.velocity === "number"
        ? Math.min(1, Math.max(0.1, candidate.velocity))
        : 0.8,
  };
}

function decodeShare(isVipUnlocked = false): BeatState | null {
  const encoded = new URLSearchParams(window.location.hash.slice(1)).get("beat");
  if (!encoded) return null;
  try {
    return validBeat(JSON.parse(decodeURIComponent(escape(window.atob(encoded)))), isVipUnlocked);
  } catch {
    return null;
  }
}

export const BeatStudio = () => {
  const [bpm, setBpm] = useState(120);
  const [isVipUnlocked, setIsVipUnlocked] = useState(false);
  const [tracks, setTracks] = useState<Track[]>(() => createTracks(false));
  const [pattern, setPattern] = useState<boolean[][]>(() => starterPattern(6));
  const [swing, setSwing] = useState(0);
  const [velocity, setVelocity] = useState(0.8);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [presetName, setPresetName] = useState("");
  const [grooveScore, setGrooveScore] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isSystemPaused, setIsSystemPaused] = useState(false);
  // Default audio to enabled so sound always works seamlessly
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [detectedLang, setDetectedLang] = useState("en");
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedStep, setSelectedStep] = useState(0);
  const [platformDialogOpen, setPlatformDialogOpen] = useState(false);
  const [activePlatformId, setActivePlatformId] = useState<PlatformId>(() => platformManager.currentId);

  const importRef = useRef<HTMLInputElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<number | null>(null);
  const isPlayingRef = useRef(false);
  const currentStepRef = useRef(0);
  const stateRef = useRef<BeatState>({ bpm, pattern, tracks, swing, velocity });
  const saveRef = useRef<() => Promise<boolean>>(async () => true);
  const lastAdTimeRef = useRef(0);
  const completedLoopsRef = useRef(0);
  const applyBeatRef = useRef<(next: BeatState) => void>(() => undefined);
  const togglePlaybackRef = useRef<() => Promise<void>>(async () => undefined);

  const canEdit = isReady && !isSystemPaused;
  const platformMeta = platformManager.currentMetadata;

  useEffect(() => {
    stateRef.current = { bpm, pattern, tracks, swing, velocity };
  }, [bpm, pattern, tracks, swing, velocity]);

  const awardScore = (points: number) => {
    setGrooveScore((prev) => {
      const nextScore = Math.min(prev + points, Number.MAX_SAFE_INTEGER);
      void platformManager.sendScore(nextScore);
      return nextScore;
    });
  };

  const stopPlayback = () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = null;
    isPlayingRef.current = false;
    setIsPlaying(false);
    currentStepRef.current = 0;
    setCurrentStep(0);
  };

  const playSound = (trackIndex: number) => {
    const ctx = audioContextRef.current;
    const current = stateRef.current;
    if (!ctx || !isAudioEnabled) return;

    const track = current.tracks[trackIndex];
    const hasSolo = current.tracks.some((item) => item.solo);
    if (!track || track.muted || (hasSolo && !track.solo)) return;

    const now = ctx.currentTime;
    const gain = ctx.createGain();
    const effectiveVol = track.volume * current.velocity;
    gain.gain.setValueAtTime(effectiveVol, now);

    // Track 5: Shaker (White Noise)
    if (trackIndex === 5) {
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
      gain.connect(ctx.destination);
      const noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.12), ctx.sampleRate);
      const data = noise.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
      const source = ctx.createBufferSource();
      source.buffer = noise;
      source.connect(gain);
      source.start(now);
      source.stop(now + 0.12);
      return;
    }

    // Track 6: 808 Sub (Deep pitch drop)
    if (trackIndex === 6) {
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
      gain.connect(ctx.destination);
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(85, now);
      osc.frequency.exponentialRampToValueAtTime(32, now + 0.6);
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 0.75);
      return;
    }

    // Track 7: Synth Lead (Melodic Pentatonic Arpeggiator)
    if (trackIndex === 7) {
      gain.gain.exponentialRampToValueAtTime(0.005, now + 0.35);
      gain.connect(ctx.destination);
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      const notes = [440, 523.25, 587.33, 659.25, 783.99];
      const note = notes[currentStepRef.current % notes.length];
      osc.frequency.setValueAtTime(note, now);
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 0.35);
      return;
    }

    // Base Instruments
    gain.gain.exponentialRampToValueAtTime(0.01, now + (trackIndex === 4 ? 0.55 : 0.22));
    gain.connect(ctx.destination);

    const oscillator = ctx.createOscillator();
    if (trackIndex === 0) {
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(150, now);
      oscillator.frequency.exponentialRampToValueAtTime(45, now + 0.28);
    } else if (trackIndex === 1) {
      oscillator.type = "triangle";
      oscillator.frequency.setValueAtTime(190, now);
    } else if (trackIndex === 2) {
      oscillator.type = "square";
      oscillator.frequency.setValueAtTime(6800, now);
    } else if (trackIndex === 3) {
      oscillator.type = "sawtooth";
      oscillator.frequency.setValueAtTime(950, now);
    } else {
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(62, now);
      oscillator.frequency.exponentialRampToValueAtTime(48, now + 0.45);
    }

    oscillator.connect(gain);
    oscillator.start(now);
    oscillator.stop(now + (trackIndex === 4 ? 0.55 : trackIndex === 0 ? 0.3 : 0.2));
  };

  const scheduleNextStep = () => {
    const current = stateRef.current;
    const nextStep = (currentStepRef.current + 1) % STEPS;
    const baseDuration = (60 / current.bpm / 4) * 1000;
    const swingMultiplier =
      nextStep % 2 === 0 ? 1 - current.swing / 200 : 1 + current.swing / 200;

    timerRef.current = window.setTimeout(() => {
      if (!isPlayingRef.current) return;
      current.pattern.forEach((row, trackIndex) => {
        if (row[nextStep]) playSound(trackIndex);
      });
      currentStepRef.current = nextStep;
      setCurrentStep(nextStep);

      // Award points on loop completion
      if (nextStep === 0) {
        completedLoopsRef.current += 1;
        if (completedLoopsRef.current % 4 === 0) {
          awardScore(20);
        }
      }

      scheduleNextStep();
    }, baseDuration * swingMultiplier);
  };

  const togglePlayback = async () => {
    if (!canEdit) return;
    if (isPlayingRef.current) {
      stopPlayback();
      return;
    }

    // Auto-unmute if user clicks play
    if (!isAudioEnabled) {
      setIsAudioEnabled(true);
    }

    try {
      if (audioContextRef.current?.state === "suspended") {
        await audioContextRef.current.resume();
      }
      isPlayingRef.current = true;
      setIsPlaying(true);
      stateRef.current.pattern.forEach((row, trackIndex) => {
        if (row[currentStepRef.current]) playSound(trackIndex);
      });
      scheduleNextStep();
      awardScore(5);
    } catch {
      toast.error("Audio could not start in this browser session");
    }
  };

  const currentBeat = (): BeatState => ({ bpm, pattern, tracks, swing, velocity });

  const applyBeat = (next: BeatState) => {
    stopPlayback();
    setBpm(next.bpm);
    setPattern(next.pattern.map((row) => [...row]));
    setTracks(next.tracks.map((track) => ({ ...track })));
    setSwing(next.swing);
    setVelocity(next.velocity);
  };
  applyBeatRef.current = applyBeat;
  togglePlaybackRef.current = togglePlayback;

  saveRef.current = async () => {
    const payload = JSON.stringify({
      ...currentBeat(),
      presets,
      grooveScore,
      isVipUnlocked,
    });
    return await platformManager.saveData(payload);
  };

  // 1. AudioContext setup
  useEffect(() => {
    audioContextRef.current = new (window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)();
    return () => {
      stopPlayback();
      void audioContextRef.current?.close();
    };
  }, []);

  // 2. Audio muting control
  useEffect(() => {
    if (!isAudioEnabled) {
      void audioContextRef.current?.suspend();
    } else if (audioContextRef.current?.state === "suspended" && isPlaying) {
      void audioContextRef.current?.resume();
    }
  }, [isAudioEnabled, isPlaying]);

  // 3. Multi-platform lifecycle initialization
  useEffect(() => {
    let mounted = true;
    let cleanup = () => undefined;

    const setup = async () => {
      cleanup = await platformManager.initialize({
        onAudioMutedChange: (isMuted) => {
          setIsAudioEnabled(!isMuted);
          if (isMuted) stopPlayback();
        },
        onPause: () => {
          setIsSystemPaused(true);
          stopPlayback();
          void saveRef.current();
        },
        onResume: () => {
          setIsSystemPaused(false);
        },
        onLanguage: (lang) => {
          setDetectedLang(lang);
          document.documentElement.lang = lang;
        },
      });

      platformManager.firstFrameReady();

      // Load saved state
      const rawData = await platformManager.loadData();
      let loadedBeat: BeatState | null = null;
      let vipUnlocked = false;

      if (rawData) {
        try {
          const parsed = JSON.parse(rawData) as SavedStudio;
          vipUnlocked = Boolean(parsed.isVipUnlocked);
          if (vipUnlocked) {
            setIsVipUnlocked(true);
            setTracks(createTracks(true));
          }
          if (typeof parsed.grooveScore === "number") {
            setGrooveScore(parsed.grooveScore);
          }
          if (Array.isArray(parsed.presets)) {
            setPresets(parsed.presets.slice(0, MAX_PRESETS));
          }
          loadedBeat = validBeat(parsed, vipUnlocked);
        } catch {
          /* parse fallback */
        }
      }

      const shared = decodeShare(vipUnlocked);
      if (mounted && (shared || loadedBeat)) {
        applyBeatRef.current(shared || loadedBeat!);
      }

      if (mounted) {
        setIsReady(true);
        platformManager.gameReady();
      }
    };

    void setup().catch(() => {
      if (mounted) {
        setIsReady(true);
        platformManager.gameReady();
      }
    });

    return () => {
      mounted = false;
      cleanup();
    };
  }, []);

  // Auto-save changes
  useEffect(() => {
    if (isReady) {
      void saveRef.current();
    }
  }, [bpm, pattern, tracks, swing, velocity, presets, grooveScore, isVipUnlocked, isReady]);

  // Keyboard navigation & accessibility
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!canEdit || event.target instanceof HTMLInputElement) return;
      if (event.key === " ") {
        event.preventDefault();
        void togglePlaybackRef.current();
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setSelectedStep((step) => (step + STEPS - 1) % STEPS);
        return;
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        setSelectedStep((step) => (step + 1) % STEPS);
        return;
      }
      if (event.key.toLowerCase() === "m") {
        event.preventDefault();
        setIsAudioEnabled((prev) => !prev);
        return;
      }
      if (event.key.toLowerCase() === "f") {
        void (document.fullscreenElement
          ? document.exitFullscreen()
          : document.documentElement.requestFullscreen());
        return;
      }
      const trackIndex = Number(event.key) - 1;
      if (trackIndex >= 0 && trackIndex < tracks.length) {
        event.preventDefault();
        setPattern((current) =>
          current.map((row, idx) =>
            idx === trackIndex
              ? row.map((val, step) => (step === selectedStep ? !val : val))
              : row
          )
        );
        awardScore(2);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [canEdit, selectedStep, tracks.length]);

  // Assistive text game output
  useEffect(() => {
    (window as Window & { render_game_to_text?: () => string }).render_game_to_text = () =>
      JSON.stringify({
        mode: isPlaying ? "playing" : "editing",
        platform: platformManager.currentId,
        bpm,
        swing,
        velocity,
        currentStep,
        selectedStep,
        grooveScore,
        isVipUnlocked,
        tracks: tracks.map(({ name, muted, solo, volume }) => ({ name, muted, solo, volume })),
      });
  }, [bpm, currentStep, isPlaying, isVipUnlocked, grooveScore, selectedStep, swing, tracks, velocity]);

  const toggleBeat = (trackIndex: number, stepIndex: number) => {
    if (!canEdit) return;
    setSelectedStep(stepIndex);
    setPattern((current) =>
      current.map((row, idx) =>
        idx === trackIndex ? row.map((val, step) => (step === stepIndex ? !val : val)) : row
      )
    );
    awardScore(2);
  };

  const shufflePattern = async () => {
    if (!canEdit) return;

    // Trigger platform interstitial ad on natural breakpoint (with 45s cooldown)
    const now = Date.now();
    if (now - lastAdTimeRef.current > 45000) {
      lastAdTimeRef.current = now;
      await platformManager.requestInterstitial();
    }

    setPattern(
      tracks.map((_, trackIndex) =>
        Array.from({ length: STEPS }, (_, step) =>
          trackIndex === 0
            ? step % 4 === 0
            : Math.random() > (trackIndex === 2 ? 0.45 : trackIndex === 6 ? 0.8 : 0.72)
        )
      )
    );
    awardScore(25);
    toast.success("New soundscape groove generated");
  };

  const handleUnlockVipPack = async () => {
    if (isVipUnlocked) {
      toast.info("VIP Neon Sound Pack is already active!");
      return;
    }

    toast.loading("Preparing rewarded ad...");
    const rewarded = await platformManager.requestReward(REWARD_VIP_ID);
    toast.dismiss();

    if (rewarded) {
      setIsVipUnlocked(true);
      const updatedTracks = createTracks(true);
      setTracks(updatedTracks);
      setPattern((prev) => {
        if (prev.length >= updatedTracks.length) return prev;
        return [...prev, ...emptyPattern(updatedTracks.length - prev.length)];
      });
      awardScore(100);
      toast.success("VIP Sound Pack Unlocked! 808 Sub and Synth Lead are ready.");
    } else {
      toast.error("Rewarded ad could not be displayed at this time.");
    }
  };

  const handleSelectPlatform = async (id: PlatformId) => {
    setActivePlatformId(id);
    await platformManager.switchPlatform(id);
    toast.success(`Active platform switched to ${platformManager.currentMetadata.name}`);
  };

  const savePreset = () => {
    const name = presetName.trim().slice(0, 32);
    if (!name) {
      toast.error("Give your preset a name first");
      return;
    }
    if (presets.length >= MAX_PRESETS) {
      toast.error(`Keep up to ${MAX_PRESETS} presets`);
      return;
    }
    setPresets((current) => [
      { id: crypto.randomUUID(), name, favorite: false, beat: cloneBeat(currentBeat()) },
      ...current,
    ]);
    setPresetName("");
    awardScore(15);
    toast.success(`Saved “${name}”`);
  };

  const exportJson = async () => {
    const now = Date.now();
    if (now - lastAdTimeRef.current > 60000) {
      lastAdTimeRef.current = now;
      await platformManager.requestInterstitial();
    }

    const blob = new Blob(
      [JSON.stringify({ ...currentBeat(), presets, grooveScore, isVipUnlocked }, null, 2)],
      { type: "application/json" }
    );
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `soundscape-studio-${bpm}bpm.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success("Soundscape project exported");
  };

  const importJson = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const imported = JSON.parse(await file.text()) as SavedStudio;
      if (imported.isVipUnlocked && !isVipUnlocked) {
        setIsVipUnlocked(true);
        setTracks(createTracks(true));
      }
      const importedBeat = validBeat(imported, Boolean(imported.isVipUnlocked || isVipUnlocked));
      if (!importedBeat) throw new Error("Invalid soundscape file");
      applyBeat(importedBeat);
      if (Array.isArray(imported.presets)) setPresets(imported.presets.slice(0, MAX_PRESETS));
      if (typeof imported.grooveScore === "number") setGrooveScore(imported.grooveScore);
      toast.success("Soundscape imported successfully");
    } catch {
      toast.error("That file is not a valid Soundscape export");
    } finally {
      event.target.value = "";
    }
  };

  const shareBeat = async () => {
    const encoded = window.btoa(unescape(encodeURIComponent(JSON.stringify(currentBeat()))));
    const url = `${window.location.origin}${window.location.pathname}#beat=${encodeURIComponent(
      encoded
    )}`;
    window.history.replaceState(null, "", `#beat=${encodeURIComponent(encoded)}`);
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Share link copied to clipboard");
    } catch {
      toast.success("Share link added to this page URL");
    }
  };

  return (
    <main className="studio-shell">
      <div className="studio-frame">
        {/* Apple Design Fluid Header */}
        <header className="apple-header">
          <div>
            <div className="flex items-center gap-3">
              <p className="studio-kicker">SPATIAL SOUNDSCAPE</p>
              <button
                type="button"
                className="apple-pill"
                onClick={() => setPlatformDialogOpen(true)}
                title="Select Gaming Platform Engine"
              >
                <Layers className="w-3.5 h-3.5 text-sky-400" />
                <span>{platformMeta.name}</span>
                <span className="status-dot is-live" />
              </button>
            </div>
            <h1 className="studio-wordmark">
              BEAT <span>STUDIO</span>
            </h1>
          </div>

          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2">
              {/* Interactive Master Mute/Unmute Speaker */}
              <button
                type="button"
                className={`apple-pill ${!isAudioEnabled ? "text-red-400 border-red-500/40" : ""}`}
                onClick={() => setIsAudioEnabled((prev) => !prev)}
                title={isAudioEnabled ? "Mute Master Audio" : "Unmute Master Audio"}
              >
                {isAudioEnabled ? <Volume2 className="w-3.5 h-3.5 text-emerald-400" /> : <VolumeX className="w-3.5 h-3.5" />}
                <span>{isAudioEnabled ? "Audio On" : "Muted"}</span>
              </button>

              <div className="score-badge" title="Mastery Score">
                <Trophy className="w-3.5 h-3.5" />
                <span>{grooveScore.toLocaleString()} PTS</span>
              </div>
            </div>
            <p className="studio-shortcuts">Space play · M mute · ←/→ step · 1–8 toggle · F fullscreen</p>
          </div>
        </header>

        {/* Real-time Apple Fluid Visualizer */}
        <div className="px-6 py-2 bg-black/20">
          <SoundscapeVisualizer
            isPlaying={isPlaying}
            bpm={bpm}
            currentStep={currentStep}
            isAudioEnabled={isAudioEnabled}
          />
        </div>

        {/* Playback & Parameters Bar */}
        <section className="studio-console" aria-label="Playback controls">
          <Button
            className="studio-play"
            onClick={togglePlayback}
            disabled={!canEdit}
            size="lg"
          >
            {isPlaying ? <Pause /> : <Play fill="currentColor" />}
            <span>{isPlaying ? "Pause" : "Play"}</span>
          </Button>

          <div className="studio-parameters">
            <label>
              <span>
                BPM <b>{bpm}</b>
              </span>
              <Slider
                value={[bpm]}
                onValueChange={([val]) => setBpm(val)}
                disabled={!canEdit}
                min={60}
                max={200}
                step={1}
              />
            </label>
            <label>
              <span>
                Swing <b>{swing}%</b>
              </span>
              <Slider
                value={[swing]}
                onValueChange={([val]) => setSwing(val)}
                disabled={!canEdit}
                min={0}
                max={50}
                step={1}
              />
            </label>
            <label>
              <span>
                Velocity <b>{Math.round(velocity * 100)}%</b>
              </span>
              <Slider
                value={[velocity]}
                onValueChange={([val]) => setVelocity(val)}
                disabled={!canEdit}
                min={0.1}
                max={1}
                step={0.05}
              />
            </label>
          </div>

          <div className="studio-actions">
            {/* Rewarded Ad VIP Pack Button */}
            <Button
              className={`reward-btn ${isVipUnlocked ? "is-unlocked" : ""}`}
              onClick={handleUnlockVipPack}
              disabled={!canEdit}
              variant="outline"
              size="sm"
            >
              <Sparkles className="w-3.5 h-3.5 mr-1" />
              {isVipUnlocked ? "VIP Pack Active" : "Unlock VIP Pack"}
            </Button>

            <Button
              onClick={() => {
                setPattern(emptyPattern(tracks.length));
                stopPlayback();
              }}
              disabled={!canEdit}
              variant="ghost"
            >
              Clear
            </Button>
            <Button onClick={shufflePattern} disabled={!canEdit} variant="ghost">
              <Shuffle />
              Shuffle
            </Button>
            <Button onClick={shareBeat} disabled={!canEdit} variant="ghost">
              <Share2 />
              Share
            </Button>
            <Button onClick={exportJson} disabled={!canEdit} variant="ghost">
              <FileDown />
              Export
            </Button>
            <Button
              onClick={() => importRef.current?.click()}
              disabled={!canEdit}
              variant="ghost"
            >
              <Upload />
              Import
            </Button>
            <input
              ref={importRef}
              className="hidden"
              type="file"
              accept="application/json,.json"
              onChange={importJson}
            />
          </div>
        </section>

        {/* Presets Strip */}
        <section className="preset-strip">
          <div className="preset-strip-label">
            <Star /> <span>PRESETS</span>
          </div>
          <div className="preset-strip-content">
            <input
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              disabled={!canEdit}
              maxLength={32}
              placeholder="Name this soundscape…"
            />
            <Button onClick={savePreset} disabled={!canEdit} variant="ghost">
              <Save /> Save
            </Button>
            {presets.map((preset) => (
              <div className="preset-chip" key={preset.id}>
                <button onClick={() => applyBeat(preset.beat)} disabled={!canEdit}>
                  {preset.name}
                </button>
                <button
                  aria-label={`Favorite ${preset.name}`}
                  onClick={() =>
                    setPresets((items) =>
                      items.map((item) =>
                        item.id === preset.id ? { ...item, favorite: !item.favorite } : item
                      )
                    )
                  }
                  disabled={!canEdit}
                >
                  <Star className={preset.favorite ? "is-favorite" : ""} />
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* 16-Step Sequencer Surface */}
        <section className="sequencer-surface">
          <div className="section-heading">
            <div>
              <p>16-STEP SOUNDSCAPE SEQUENCER</p>
              <h2>Build an atmospheric loop with rhythmic warmth.</h2>
            </div>
            <SlidersHorizontal />
          </div>

          <div className="step-numbers" aria-hidden="true">
            {Array.from({ length: STEPS }, (_, idx) => (
              <span key={idx}>{String(idx + 1).padStart(2, "0")}</span>
            ))}
          </div>

          {tracks.map((track, trackIndex) => (
            <section key={track.name} className="track-lane">
              <div className="track-label" style={{ "--track": track.color } as CSSProperties}>
                <span>{track.name}</span>
                <small>{track.muted ? "MUTED" : track.solo ? "SOLO" : "READY"}</small>
              </div>

              <div className="step-grid">
                {pattern[trackIndex]?.map((enabled, stepIndex) => (
                  <button
                    key={stepIndex}
                    type="button"
                    onClick={() => toggleBeat(trackIndex, stepIndex)}
                    disabled={!canEdit}
                    aria-label={`${track.name}, step ${stepIndex + 1}`}
                    className={`step-cell ${enabled ? "is-active" : ""} ${
                      currentStep === stepIndex && isPlaying ? "is-current" : ""
                    } ${selectedStep === stepIndex ? "is-selected" : ""}`}
                    style={{ "--track": track.color } as CSSProperties}
                  />
                ))}
              </div>
            </section>
          ))}
        </section>

        {/* Mixer Surface */}
        <section className="mixer-surface">
          <div className="section-heading">
            <div>
              <p>MIXER CONSOLE</p>
              <h2>Shape volume, mutes, and solo lines.</h2>
            </div>
          </div>

          <div className="mixer-grid">
            {tracks.map((track, index) => (
              <article
                className="mix-channel"
                key={track.name}
                style={{ "--track": track.color } as CSSProperties}
              >
                <div>
                  <span>{track.name}</span>
                  <b>{Math.round(track.volume * 100)}%</b>
                </div>

                <Slider
                  value={[track.volume]}
                  onValueChange={([val]) =>
                    setTracks((items) =>
                      items.map((item, itemIdx) =>
                        itemIdx === index ? { ...item, volume: val } : item
                      )
                    )
                  }
                  disabled={!canEdit}
                  min={0}
                  max={1}
                  step={0.05}
                />

                <div className="mix-actions">
                  <Button
                    aria-label={`Mute ${track.name}`}
                    onClick={() =>
                      setTracks((items) =>
                        items.map((item, itemIdx) =>
                          itemIdx === index ? { ...item, muted: !item.muted } : item
                        )
                      )
                    }
                    disabled={!canEdit}
                    size="icon"
                    variant="ghost"
                  >
                    {track.muted ? <VolumeX /> : <Volume2 />}
                  </Button>

                  <Button
                    onClick={() =>
                      setTracks((items) =>
                        items.map((item, itemIdx) =>
                          itemIdx === index ? { ...item, solo: !item.solo } : item
                        )
                      )
                    }
                    disabled={!canEdit}
                    variant="ghost"
                    className={track.solo ? "is-solo" : ""}
                  >
                    Solo
                  </Button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>

      {/* Universal Multi-Platform Engine Switcher & Verification Dialog */}
      <Dialog open={platformDialogOpen} onOpenChange={setPlatformDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-sky-400" />
              Native Multi-Platform Engine
            </DialogTitle>
            <DialogDescription>
              Native zero-dependency SDK bridge for all 13 major web and app gaming platforms.
            </DialogDescription>
          </DialogHeader>

          {/* Active Platform Card */}
          <div className="apple-glass-card mt-2">
            <div className="flex justify-between items-center mb-1">
              <span>Active Target</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 font-mono">
                {platformMeta.sdkName}
              </span>
            </div>
            <b>{platformMeta.name}</b>
            <p className="text-xs text-muted-foreground mt-1">{platformMeta.description}</p>
          </div>

          <div className="mt-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
              Select Platform Target
            </p>
            <div className="platform-grid">
              {SUPPORTED_PLATFORMS.map((platform) => (
                <button
                  key={platform.id}
                  type="button"
                  onClick={() => handleSelectPlatform(platform.id)}
                  className={`platform-chip ${activePlatformId === platform.id ? "is-selected" : ""}`}
                >
                  <span>{platform.name}</span>
                  <small>{platform.sdkName}</small>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2 mt-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Verification & Ad Testing
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  toast.loading("Testing Interstitial Ad...");
                  const ok = await platformManager.requestInterstitial();
                  toast.dismiss();
                  toast.success(ok ? "Interstitial completed" : "Interstitial handled");
                }}
              >
                Test Interstitial Ad
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  toast.loading("Testing Rewarded Ad...");
                  const ok = await platformManager.requestReward(REWARD_VIP_ID);
                  toast.dismiss();
                  toast.success(ok ? "Rewarded Ad success" : "Rewarded Ad not completed");
                }}
              >
                Test Rewarded Ad
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  const newScore = grooveScore + 50;
                  setGrooveScore(newScore);
                  await platformManager.sendScore(newScore);
                  toast.success(`Sent score: ${newScore}`);
                }}
              >
                Test Send Score (+50)
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsAudioEnabled((prev) => !prev);
                  toast.success(isAudioEnabled ? "Audio muted" : "Audio unmuted");
                }}
              >
                Toggle Master Audio
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
};
