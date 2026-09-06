import { ChangeEvent, useEffect, useRef, useState } from "react";
import { FileDown, Pause, Play, Save, Share2, Shuffle, SlidersHorizontal, Star, Upload, Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
  const [pattern, setPattern] = useState<boolean[][]>(() => emptyPattern());
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
  const togglePlayback = () => {
    if (!canEdit) return;
    if (isPlayingRef.current) { stopPlayback(); return; }
    void audioContextRef.current?.resume(); isPlayingRef.current = true; setIsPlaying(true); scheduleNextStep();
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

  return <main className="min-h-screen bg-background p-3 sm:p-5 md:p-8"><div className="mx-auto max-w-7xl space-y-5">
    <header className="space-y-2 text-center"><h1 className="bg-gradient-to-r from-primary via-accent to-secondary bg-clip-text text-3xl font-bold text-transparent sm:text-5xl">Beat Studio</h1><p className="text-sm text-muted-foreground sm:text-base">Space: play • ←/→: select step • 1–6: toggle track • F: fullscreen</p></header>
    <Card className="space-y-4 p-4 sm:p-6"><div className="flex flex-wrap items-center gap-2"><Button onClick={togglePlayback} disabled={!canEdit} size="lg">{isPlaying ? <Pause className="mr-2" /> : <Play className="mr-2" />}{isPlaying ? "Pause" : "Play"}</Button><Button onClick={() => { setPattern(emptyPattern(tracks.length)); stopPlayback(); }} disabled={!canEdit} variant="outline">Clear</Button><Button onClick={shufflePattern} disabled={!canEdit} variant="outline"><Shuffle className="mr-2" />Shuffle</Button><Button onClick={shareBeat} disabled={!canEdit} variant="outline"><Share2 className="mr-2" />Share</Button><Button onClick={exportJson} disabled={!canEdit} variant="outline"><FileDown className="mr-2" />JSON</Button><Button onClick={() => importRef.current?.click()} disabled={!canEdit} variant="outline"><Upload className="mr-2" />Import</Button><input ref={importRef} className="hidden" type="file" accept="application/json,.json" onChange={importJson} /></div><div className="grid gap-4 sm:grid-cols-3"><label className="space-y-2 text-sm font-medium">BPM: {bpm}<Slider value={[bpm]} onValueChange={([value]) => setBpm(value)} disabled={!canEdit} min={60} max={200} step={1} /></label><label className="space-y-2 text-sm font-medium">Swing: {swing}%<Slider value={[swing]} onValueChange={([value]) => setSwing(value)} disabled={!canEdit} min={0} max={50} step={1} /></label><label className="space-y-2 text-sm font-medium">Velocity: {Math.round(velocity * 100)}%<Slider value={[velocity]} onValueChange={([value]) => setVelocity(value)} disabled={!canEdit} min={0.1} max={1} step={0.05} /></label></div></Card>
    <Card className="space-y-3 p-4 sm:p-6"><div className="flex items-center gap-2"><SlidersHorizontal className="h-4 w-4 text-secondary" /><h2 className="font-semibold">Track mix & instruments</h2></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{tracks.map((track, index) => <div className="rounded-lg border border-border p-3" key={track.name}><div className="mb-2 flex items-center justify-between"><span className="font-medium" style={{ color: track.color }}>{track.name}</span><span className="text-xs text-muted-foreground">{Math.round(track.volume * 100)}%</span></div><div className="flex items-center gap-2"><Button aria-label={`Mute ${track.name}`} onClick={() => setTracks((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, muted: !item.muted } : item))} disabled={!canEdit} size="icon" variant={track.muted ? "default" : "outline"}>{track.muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}</Button><Button onClick={() => setTracks((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, solo: !item.solo } : item))} disabled={!canEdit} size="sm" variant={track.solo ? "default" : "outline"}>Solo</Button><Slider value={[track.volume]} onValueChange={([value]) => setTracks((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, volume: value } : item))} disabled={!canEdit} min={0} max={1} step={0.05} /></div></div>)}</div></Card>
    <Card className="space-y-4 p-3 sm:p-6">{tracks.map((track, trackIndex) => <section key={track.name} className="space-y-2 sm:flex sm:items-center sm:gap-4 sm:space-y-0"><div className="flex items-center justify-between text-sm font-medium sm:w-20 sm:block sm:text-right" style={{ color: track.color }}><span>{track.name}</span><span className="sm:hidden">{track.muted ? "Muted" : track.solo ? "Solo" : ""}</span></div><div className="grid w-full grid-cols-4 gap-2 sm:grid-cols-8 md:[grid-template-columns:repeat(16,minmax(0,1fr))]">{pattern[trackIndex].map((enabled, stepIndex) => <button key={stepIndex} onClick={() => toggleBeat(trackIndex, stepIndex)} disabled={!canEdit} aria-label={`${track.name}, step ${stepIndex + 1}`} className={`aspect-square min-h-12 rounded-md transition-all sm:min-h-[40px] ${enabled ? "opacity-100 shadow-lg" : "opacity-25 hover:opacity-50"} ${currentStep === stepIndex && isPlaying ? "ring-2 ring-white" : ""} ${selectedStep === stepIndex ? "outline outline-2 outline-offset-2 outline-secondary" : ""}`} style={{ backgroundColor: track.color, boxShadow: enabled ? `0 0 15px ${track.color}` : "none" }} />)}</div></section>)}</Card>
    <Card className="space-y-3 p-4 sm:p-6"><div className="flex flex-col gap-2 sm:flex-row"><input value={presetName} onChange={(event) => setPresetName(event.target.value)} disabled={!canEdit} maxLength={32} placeholder="Name this beat…" className="h-10 flex-1 rounded-md border border-input bg-background px-3 text-sm" /><Button onClick={savePreset} disabled={!canEdit}><Save className="mr-2" />Save preset</Button></div>{presets.length > 0 && <div className="flex flex-wrap gap-2">{presets.map((preset) => <div className="flex overflow-hidden rounded-md border border-border" key={preset.id}><button className="px-3 py-2 text-sm hover:bg-muted" onClick={() => applyBeat(preset.beat)} disabled={!canEdit}>{preset.name}</button><button aria-label={`Favorite ${preset.name}`} className="border-l border-border px-2 hover:bg-muted" onClick={() => setPresets((items) => items.map((item) => item.id === preset.id ? { ...item, favorite: !item.favorite } : item))} disabled={!canEdit}><Star className={`h-4 w-4 ${preset.favorite ? "fill-yellow-400 text-yellow-400" : ""}`} /></button></div>)}</div>}</Card>
  </div></main>;
};
