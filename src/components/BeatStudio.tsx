import { ChangeEvent, CSSProperties, useEffect, useRef, useState } from "react";
import { FileDown, Pause, Play, Save, Share2, Shuffle, SlidersHorizontal, Star, Upload, Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { initializePlayables, loadPlayableData, markPlayableReady, reportPlayableError, savePlayableData } from "@/lib/youtubePlayables";

const STEPS = 16;
const MAX_PRESETS = 20;
type Track = { name: string; color: string; volume: number; muted: boolean; solo: boolean };
type BeatState = { bpm: number; pattern: boolean[][]; tracks: Track[]; swing: number; velocity: number };
type Preset = { id: string; name: string; favorite: boolean; beat: BeatState };
type SavedStudio = Partial<BeatState> & { presets?: Preset[] };

const createTracks = (): Track[] => [
  { name: "Kick", color: "hsl(280 85% 65%)", volume: 0.9, muted: false, solo: false },
  { name: "Snare", color: "hsl(190 85% 55%)", volume: 0.75, muted: false, solo: false },
  { name: "Hi-Hat", color: "hsl(330 85% 60%)", volume: 0.5, muted: false, solo: false },
  { name: "Clap", color: "hsl(145 80% 55%)", volume: 0.65, muted: false, solo: false },
  { name: "Bass", color: "hsl(45 95% 60%)", volume: 0.7, muted: false, solo: false },
  { name: "Shaker", color: "hsl(15 90% 65%)", volume: 0.45, muted: false, solo: false },
];
const emptyPattern = (count = createTracks().length) => Array.from({ length: count }, () => Array(STEPS).fill(false));
const starterPattern = () => {
  const pattern = emptyPattern();
  [0, 4, 8, 12].forEach((step) => { pattern[0][step] = true; pattern[4][step] = true; });
  [4, 12].forEach((step) => { pattern[1][step] = true; });
  [0, 2, 4, 6, 8, 10, 12, 14].forEach((step) => { pattern[2][step] = true; });
  [6, 14].forEach((step) => { pattern[3][step] = true; });
  [3, 7, 11, 15].forEach((step) => { pattern[5][step] = true; });
  return pattern;
};
const cloneBeat = (beat: BeatState): BeatState => ({ ...beat, pattern: beat.pattern.map((row) => [...row]), tracks: beat.tracks.map((track) => ({ ...track })) });

function validBeat(value: unknown): BeatState | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as SavedStudio;
  const defaults = createTracks();
  const pattern = Array.isArray(candidate.pattern) && candidate.pattern.length >= 4 && candidate.pattern.length <= defaults.length && candidate.pattern.every((row) => Array.isArray(row) && row.length === STEPS && row.every((step) => typeof step === "boolean"))
    ? [...candidate.pattern.map((row) => [...row]), ...emptyPattern(defaults.length - candidate.pattern.length)]
    : null;
  if (!pattern) return null;
  return {
    bpm: typeof candidate.bpm === "number" && candidate.bpm >= 60 && candidate.bpm <= 200 ? candidate.bpm : 120,
    pattern,
    tracks: Array.isArray(candidate.tracks) && candidate.tracks.length === defaults.length ? defaults.map((fallback, index) => ({ ...fallback, volume: Math.min(1, Math.max(0, Number(candidate.tracks![index]?.volume) || fallback.volume)), muted: Boolean(candidate.tracks![index]?.muted), solo: Boolean(candidate.tracks![index]?.solo) })) : defaults,
    swing: typeof candidate.swing === "number" ? Math.min(50, Math.max(0, candidate.swing)) : 0,
    velocity: typeof candidate.velocity === "number" ? Math.min(1, Math.max(0.1, candidate.velocity)) : 0.8,
  };
}

function decodeShare(): BeatState | null {
  const encoded = new URLSearchParams(window.location.hash.slice(1)).get("beat");
  if (!encoded) return null;
  try { return validBeat(JSON.parse(decodeURIComponent(escape(window.atob(encoded))))); } catch { return null; }
}

export const BeatStudio = () => {
  const [bpm, setBpm] = useState(120);
  const [pattern, setPattern] = useState<boolean[][]>(() => starterPattern());
  const [tracks, setTracks] = useState<Track[]>(() => createTracks());
  const [swing, setSwing] = useState(0);
  const [velocity, setVelocity] = useState(0.8);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [presetName, setPresetName] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isSystemPaused, setIsSystemPaused] = useState(false);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedStep, setSelectedStep] = useState(0);
  const importRef = useRef<HTMLInputElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<number | null>(null);
  const isPlayingRef = useRef(false);
  const currentStepRef = useRef(0);
  const stateRef = useRef<BeatState>({ bpm, pattern, tracks, swing, velocity });
  const saveRef = useRef<() => Promise<void>>(async () => undefined);
  const beat = (): BeatState => ({ bpm, pattern, tracks, swing, velocity });
  const canEdit = isReady && !isSystemPaused;

  useEffect(() => { stateRef.current = beat(); }, [bpm, pattern, tracks, swing, velocity]);
  const stopPlayback = () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = null; isPlayingRef.current = false; setIsPlaying(false); currentStepRef.current = 0; setCurrentStep(0);
  };
  const playSound = (trackIndex: number) => {
    const ctx = audioContextRef.current; const current = stateRef.current;
    if (!ctx || !isAudioEnabled) return;
    const track = current.tracks[trackIndex]; const hasSolo = current.tracks.some((item) => item.solo);
    if (!track || track.muted || (hasSolo && !track.solo)) return;
    const now = ctx.currentTime; const gain = ctx.createGain();
    gain.gain.setValueAtTime(track.volume * current.velocity, now); gain.gain.exponentialRampToValueAtTime(0.01, now + (trackIndex === 4 ? 0.55 : 0.22)); gain.connect(ctx.destination);
    if (trackIndex === 5) {
      const noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.12), ctx.sampleRate); const data = noise.getChannelData(0);
      for (let index = 0; index < data.length; index += 1) data[index] = Math.random() * 2 - 1;
      const source = ctx.createBufferSource(); source.buffer = noise; source.connect(gain); source.start(now); source.stop(now + 0.12); return;
    }
    const oscillator = ctx.createOscillator();
    if (trackIndex === 0) { oscillator.type = "sine"; oscillator.frequency.setValueAtTime(150, now); oscillator.frequency.exponentialRampToValueAtTime(45, now + 0.28); }
    else if (trackIndex === 1) { oscillator.type = "triangle"; oscillator.frequency.setValueAtTime(190, now); }
    else if (trackIndex === 2) { oscillator.type = "square"; oscillator.frequency.setValueAtTime(6800, now); }
    else if (trackIndex === 3) { oscillator.type = "sawtooth"; oscillator.frequency.setValueAtTime(950, now); }
    else { oscillator.type = "sine"; oscillator.frequency.setValueAtTime(62, now); oscillator.frequency.exponentialRampToValueAtTime(48, now + 0.45); }
    oscillator.connect(gain); oscillator.start(now); oscillator.stop(now + (trackIndex === 4 ? 0.55 : trackIndex === 0 ? 0.3 : 0.2));
  };
  const scheduleNextStep = () => {
    const current = stateRef.current; const nextStep = (currentStepRef.current + 1) % STEPS;
    const baseDuration = (60 / current.bpm / 4) * 1000; const swingMultiplier = nextStep % 2 === 0 ? 1 - current.swing / 200 : 1 + current.swing / 200;
    timerRef.current = window.setTimeout(() => {
      if (!isPlayingRef.current) return;
      current.pattern.forEach((row, trackIndex) => { if (row[nextStep]) playSound(trackIndex); });
      currentStepRef.current = nextStep; setCurrentStep(nextStep); scheduleNextStep();
    }, baseDuration * swingMultiplier);
  };
  const togglePlayback = async () => {
    if (!canEdit) return;
    if (isPlayingRef.current) { stopPlayback(); return; }
    if (!isAudioEnabled) { toast.error("Sound is disabled by the YouTube player"); return; }
    try {
      await audioContextRef.current?.resume();
      if (audioContextRef.current?.state === "suspended") { toast.error("Tap Play again to enable audio"); return; }
      isPlayingRef.current = true; setIsPlaying(true);
      stateRef.current.pattern.forEach((row, trackIndex) => { if (row[currentStepRef.current]) playSound(trackIndex); });
      scheduleNextStep();
    } catch { toast.error("Audio could not start in this browser"); }
  };
  const applyBeat = (next: BeatState) => { stopPlayback(); setBpm(next.bpm); setPattern(next.pattern.map((row) => [...row])); setTracks(next.tracks.map((track) => ({ ...track }))); setSwing(next.swing); setVelocity(next.velocity); };
  saveRef.current = async () => savePlayableData(JSON.stringify({ ...beat(), presets }));

  useEffect(() => {
    audioContextRef.current = new (window.AudioContext || (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)();
    return () => { stopPlayback(); void audioContextRef.current?.close(); };
  }, []);
  useEffect(() => { if (!isAudioEnabled) void audioContextRef.current?.suspend(); }, [isAudioEnabled]);
  useEffect(() => {
    let mounted = true; let cleanup = () => undefined;
    const setup = async () => {
      cleanup = await initializePlayables({ onAudioEnabledChange: setIsAudioEnabled, onPause: () => { setIsSystemPaused(true); stopPlayback(); void saveRef.current(); }, onResume: () => setIsSystemPaused(false), onLanguage: (language) => { document.documentElement.lang = language; } });
      const rawData = await loadPlayableData(); let saved: BeatState | null = null;
      try { const parsed = JSON.parse(rawData || "null") as SavedStudio; saved = validBeat(parsed); if (Array.isArray(parsed.presets)) setPresets(parsed.presets.slice(0, MAX_PRESETS)); } catch { reportPlayableError(); }
      const shared = decodeShare(); if (mounted && (shared || saved)) applyBeat(shared || saved!);
      if (mounted) { setIsReady(true); markPlayableReady(); }
    };
    void setup().catch(() => { reportPlayableError(); if (mounted) { setIsReady(true); markPlayableReady(); } });
    return () => { mounted = false; cleanup(); };
  }, []);
  useEffect(() => { if (isReady) void saveRef.current(); }, [bpm, pattern, tracks, swing, velocity, presets, isReady]);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!canEdit || event.target instanceof HTMLInputElement) return;
      if (event.key === " ") { event.preventDefault(); togglePlayback(); return; }
      if (event.key === "ArrowLeft") { event.preventDefault(); setSelectedStep((step) => (step + STEPS - 1) % STEPS); return; }
      if (event.key === "ArrowRight") { event.preventDefault(); setSelectedStep((step) => (step + 1) % STEPS); return; }
      if (event.key.toLowerCase() === "f") { void (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()); return; }
      const trackIndex = Number(event.key) - 1;
      if (trackIndex >= 0 && trackIndex < tracks.length) { event.preventDefault(); setPattern((current) => current.map((row, index) => index === trackIndex ? row.map((value, step) => step === selectedStep ? !value : value) : row)); }
    };
    window.addEventListener("keydown", onKeyDown); return () => window.removeEventListener("keydown", onKeyDown);
  }, [canEdit, selectedStep, tracks.length]);
  useEffect(() => { (window as Window & { render_game_to_text?: () => string }).render_game_to_text = () => JSON.stringify({ mode: isPlaying ? "playing" : "editing", bpm, swing, velocity, currentStep, selectedStep, tracks: tracks.map(({ name, muted, solo, volume }) => ({ name, muted, solo, volume })) }); }, [bpm, currentStep, isPlaying, selectedStep, swing, tracks, velocity]);

  const toggleBeat = (trackIndex: number, stepIndex: number) => { if (!canEdit) return; setSelectedStep(stepIndex); setPattern((current) => current.map((row, index) => index === trackIndex ? row.map((value, step) => step === stepIndex ? !value : value) : row)); };
  const shufflePattern = () => { if (!canEdit) return; setPattern(tracks.map((_, trackIndex) => Array.from({ length: STEPS }, (_, step) => trackIndex === 0 ? step % 4 === 0 : Math.random() > (trackIndex === 2 ? 0.45 : 0.72)))); toast.success("New groove generated"); };
  const savePreset = () => { const name = presetName.trim().slice(0, 32); if (!name) { toast.error("Give your preset a name first"); return; } if (presets.length >= MAX_PRESETS) { toast.error(`Keep up to ${MAX_PRESETS} presets`); return; } setPresets((current) => [{ id: crypto.randomUUID(), name, favorite: false, beat: cloneBeat(beat()) }, ...current]); setPresetName(""); toast.success(`Saved “${name}”`); };
  const exportJson = () => { const blob = new Blob([JSON.stringify({ ...beat(), presets }, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `beat-studio-${bpm}bpm.json`; anchor.click(); URL.revokeObjectURL(url); };
  const importJson = async (event: ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (!file) return; try { const imported = JSON.parse(await file.text()) as SavedStudio; const importedBeat = validBeat(imported); if (!importedBeat) throw new Error("Invalid beat file"); applyBeat(importedBeat); if (Array.isArray(imported.presets)) setPresets(imported.presets.slice(0, MAX_PRESETS)); toast.success("Beat imported"); } catch { toast.error("That file is not a valid Beat Studio export"); } finally { event.target.value = ""; } };
  const shareBeat = async () => { const encoded = window.btoa(unescape(encodeURIComponent(JSON.stringify(beat())))); const url = `${window.location.origin}${window.location.pathname}#beat=${encodeURIComponent(encoded)}`; window.history.replaceState(null, "", `#beat=${encodeURIComponent(encoded)}`); try { await navigator.clipboard.writeText(url); toast.success("Share link copied"); } catch { toast.success("Share link added to this page URL"); } };

  return <main className="studio-shell"><div className="studio-frame">
    <header className="studio-header"><div><p className="studio-kicker">RANDOM SOUNDSCAPE MAKER</p><h1 className="studio-wordmark">BEAT <span>STUDIO</span></h1></div><p className="studio-shortcuts">Space play · ←/→ select · 1–6 toggle · F fullscreen</p></header>
    <section className="studio-console" aria-label="Playback controls"><Button className="studio-play" onClick={togglePlayback} disabled={!canEdit} size="lg">{isPlaying ? <Pause /> : <Play fill="currentColor" />}<span>{isPlaying ? "Pause" : "Play"}</span></Button><div className="studio-parameters"><label><span>BPM <b>{bpm}</b></span><Slider value={[bpm]} onValueChange={([value]) => setBpm(value)} disabled={!canEdit} min={60} max={200} step={1} /></label><label><span>Swing <b>{swing}%</b></span><Slider value={[swing]} onValueChange={([value]) => setSwing(value)} disabled={!canEdit} min={0} max={50} step={1} /></label><label><span>Velocity <b>{Math.round(velocity * 100)}%</b></span><Slider value={[velocity]} onValueChange={([value]) => setVelocity(value)} disabled={!canEdit} min={0.1} max={1} step={0.05} /></label></div><div className="studio-actions"><Button onClick={() => { setPattern(emptyPattern(tracks.length)); stopPlayback(); }} disabled={!canEdit} variant="ghost">Clear</Button><Button onClick={shufflePattern} disabled={!canEdit} variant="ghost"><Shuffle />Shuffle</Button><Button onClick={shareBeat} disabled={!canEdit} variant="ghost"><Share2 />Share</Button><Button onClick={exportJson} disabled={!canEdit} variant="ghost"><FileDown />Export</Button><Button onClick={() => importRef.current?.click()} disabled={!canEdit} variant="ghost"><Upload />Import</Button><input ref={importRef} className="hidden" type="file" accept="application/json,.json" onChange={importJson} /></div></section>
    <section className="preset-strip"><div className="preset-strip-label"><Star /> <span>PRESETS</span></div><div className="preset-strip-content"><input value={presetName} onChange={(event) => setPresetName(event.target.value)} disabled={!canEdit} maxLength={32} placeholder="Name this beat…" /><Button onClick={savePreset} disabled={!canEdit} variant="ghost"><Save /> Save</Button>{presets.map((preset) => <div className="preset-chip" key={preset.id}><button onClick={() => applyBeat(preset.beat)} disabled={!canEdit}>{preset.name}</button><button aria-label={`Favorite ${preset.name}`} onClick={() => setPresets((items) => items.map((item) => item.id === preset.id ? { ...item, favorite: !item.favorite } : item))} disabled={!canEdit}><Star className={preset.favorite ? "is-favorite" : ""} /></button></div>)}</div></section>
    <section className="sequencer-surface"><div className="section-heading"><div><p>16-STEP SEQUENCER</p><h2>Build a loop with a little glow.</h2></div><SlidersHorizontal /></div><div className="step-numbers" aria-hidden="true">{Array.from({ length: STEPS }, (_, index) => <span key={index}>{String(index + 1).padStart(2, "0")}</span>)}</div>{tracks.map((track, trackIndex) => <section key={track.name} className="track-lane"><div className="track-label" style={{ "--track": track.color } as CSSProperties}><span>{track.name}</span><small>{track.muted ? "MUTED" : track.solo ? "SOLO" : "READY"}</small></div><div className="step-grid">{pattern[trackIndex].map((enabled, stepIndex) => <button key={stepIndex} onClick={() => toggleBeat(trackIndex, stepIndex)} disabled={!canEdit} aria-label={`${track.name}, step ${stepIndex + 1}`} className={`step-cell ${enabled ? "is-active" : ""} ${currentStep === stepIndex && isPlaying ? "is-current" : ""} ${selectedStep === stepIndex ? "is-selected" : ""}`} style={{ "--track": track.color } as CSSProperties} />)}</div></section>)}</section>
    <section className="mixer-surface"><div className="section-heading"><div><p>MIXER</p><h2>Shape every voice.</h2></div></div><div className="mixer-grid">{tracks.map((track, index) => <article className="mix-channel" key={track.name} style={{ "--track": track.color } as CSSProperties}><div><span>{track.name}</span><b>{Math.round(track.volume * 100)}%</b></div><Slider value={[track.volume]} onValueChange={([value]) => setTracks((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, volume: value } : item))} disabled={!canEdit} min={0} max={1} step={0.05} /><div className="mix-actions"><Button aria-label={`Mute ${track.name}`} onClick={() => setTracks((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, muted: !item.muted } : item))} disabled={!canEdit} size="icon" variant="ghost">{track.muted ? <VolumeX /> : <Volume2 />}</Button><Button onClick={() => setTracks((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, solo: !item.solo } : item))} disabled={!canEdit} variant="ghost" className={track.solo ? "is-solo" : ""}>Solo</Button></div></article>)}</div></section>
  </div></main>;
};
