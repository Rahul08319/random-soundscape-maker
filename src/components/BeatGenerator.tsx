import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Card } from "@/components/ui/card";
import { Play, Pause, Square, Download, Shuffle } from "lucide-react";
import { toast } from "sonner";
import {
  initializePlayables,
  loadPlayableData,
  markPlayableReady,
  reportPlayableError,
  savePlayableData,
} from "@/lib/youtubePlayables";

const INSTRUMENTS = [
  { name: "Kick", color: "hsl(280 85% 65%)" },
  { name: "Snare", color: "hsl(190 85% 55%)" },
  { name: "Hi-Hat", color: "hsl(330 85% 60%)" },
  { name: "Clap", color: "hsl(145 80% 55%)" },
];

const STEPS = 16;
const emptyPattern = () => INSTRUMENTS.map(() => Array(STEPS).fill(false));

type SavedBeat = { bpm?: number; pattern?: boolean[][] };

function parseSavedBeat(rawData: string): SavedBeat | null {
  if (!rawData) return null;
  try {
    const parsed = JSON.parse(rawData) as SavedBeat;
    const hasValidPattern = Array.isArray(parsed.pattern) && parsed.pattern.length === INSTRUMENTS.length &&
      parsed.pattern.every((track) => Array.isArray(track) && track.length === STEPS && track.every((beat) => typeof beat === "boolean"));
    const hasValidBpm = typeof parsed.bpm === "number" && parsed.bpm >= 60 && parsed.bpm <= 200;
    return hasValidPattern || hasValidBpm ? parsed : null;
  } catch {
    reportPlayableError();
    return null;
  }
}

export const BeatGenerator = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isPlayableReady, setIsPlayableReady] = useState(false);
  const [isSystemPaused, setIsSystemPaused] = useState(false);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [bpm, setBpm] = useState(120);
  const [currentStep, setCurrentStep] = useState(0);
  const [pattern, setPattern] = useState<boolean[][]>(
    emptyPattern()
  );

  const audioContextRef = useRef<AudioContext | null>(null);
  const intervalRef = useRef<number | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const saveCurrentBeatRef = useRef<() => Promise<void>>(async () => undefined);

  const stopPlayback = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    setIsPlaying(false);
    setCurrentStep(0);
  };

  useEffect(() => {
    audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      audioContextRef.current?.close();
    };
  }, []);

  useEffect(() => {
    if (!isAudioEnabled) void audioContextRef.current?.suspend();
  }, [isAudioEnabled]);

  useEffect(() => {
    let isMounted = true;
    let cleanup = () => undefined;

    const startPlayables = async () => {
      cleanup = await initializePlayables({
        onAudioEnabledChange: setIsAudioEnabled,
        onPause: () => {
          setIsSystemPaused(true);
          stopPlayback();
          void saveCurrentBeatRef.current();
        },
        onResume: () => setIsSystemPaused(false),
        onLanguage: (language) => { document.documentElement.lang = language; },
      });

      const savedBeat = parseSavedBeat(await loadPlayableData());
      if (isMounted && savedBeat) {
        if (typeof savedBeat.bpm === "number") setBpm(savedBeat.bpm);
        if (savedBeat.pattern) setPattern(savedBeat.pattern);
      }
      if (isMounted) {
        setIsPlayableReady(true);
        markPlayableReady();
      }
    };

    void startPlayables();
    return () => { isMounted = false; cleanup(); };
  }, []);

  saveCurrentBeatRef.current = () => savePlayableData(JSON.stringify({ bpm, pattern }));

  useEffect(() => {
    if (isPlayableReady) void saveCurrentBeatRef.current();
  }, [bpm, pattern, isPlayableReady]);

  const playSound = (instrumentIndex: number) => {
    if (!audioContextRef.current || !isAudioEnabled) return;

    const ctx = audioContextRef.current;
    const now = ctx.currentTime;

    switch (instrumentIndex) {
      case 0: // Kick
        const kickOsc = ctx.createOscillator();
        const kickGain = ctx.createGain();
        kickOsc.frequency.setValueAtTime(150, now);
        kickOsc.frequency.exponentialRampToValueAtTime(0.01, now + 0.5);
        kickGain.gain.setValueAtTime(1, now);
        kickGain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
        kickOsc.connect(kickGain).connect(ctx.destination);
        kickOsc.start(now);
        kickOsc.stop(now + 0.5);
        break;

      case 1: // Snare
        const snareOsc = ctx.createOscillator();
        const snareGain = ctx.createGain();
        snareOsc.type = "triangle";
        snareOsc.frequency.setValueAtTime(200, now);
        snareGain.gain.setValueAtTime(0.3, now);
        snareGain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        snareOsc.connect(snareGain).connect(ctx.destination);
        snareOsc.start(now);
        snareOsc.stop(now + 0.2);
        break;

      case 2: // Hi-Hat
        const hihatOsc = ctx.createOscillator();
        const hihatGain = ctx.createGain();
        hihatOsc.type = "square";
        hihatOsc.frequency.setValueAtTime(8000, now);
        hihatGain.gain.setValueAtTime(0.1, now);
        hihatGain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        hihatOsc.connect(hihatGain).connect(ctx.destination);
        hihatOsc.start(now);
        hihatOsc.stop(now + 0.1);
        break;

      case 3: // Clap
        const clapOsc = ctx.createOscillator();
        const clapGain = ctx.createGain();
        clapOsc.type = "sawtooth";
        clapOsc.frequency.setValueAtTime(1000, now);
        clapGain.gain.setValueAtTime(0.2, now);
        clapGain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        clapOsc.connect(clapGain).connect(ctx.destination);
        clapOsc.start(now);
        clapOsc.stop(now + 0.15);
        break;
    }
  };

  const togglePlay = () => {
    if (!isPlayableReady || isSystemPaused) return;
    if (isPlaying) {
      stopPlayback();
    } else {
      void audioContextRef.current?.resume();
      setIsPlaying(true);
      const stepDuration = (60 / bpm / 4) * 1000;

      intervalRef.current = window.setInterval(() => {
        setCurrentStep((prev) => {
          const nextStep = (prev + 1) % STEPS;
          
          pattern.forEach((track, instrumentIndex) => {
            if (track[nextStep]) {
              playSound(instrumentIndex);
            }
          });

          return nextStep;
        });
      }, stepDuration);
    }
  };

  const toggleBeat = (instrumentIndex: number, stepIndex: number) => {
    if (!isPlayableReady || isSystemPaused) return;
    const newPattern = [...pattern];
    newPattern[instrumentIndex][stepIndex] = !newPattern[instrumentIndex][stepIndex];
    setPattern(newPattern);
  };

  const randomizePattern = () => {
    if (!isPlayableReady || isSystemPaused) return;
    const newPattern = INSTRUMENTS.map(() =>
      Array(STEPS)
        .fill(false)
        .map(() => Math.random() > 0.7)
    );
    setPattern(newPattern);
    toast.success("Random beat generated!");
  };

  const clearPattern = () => {
    if (!isPlayableReady || isSystemPaused) return;
    setPattern(emptyPattern());
    toast.info("Pattern cleared");
  };

  const exportPattern = async () => {
    if (!audioContextRef.current || !isPlayableReady || isSystemPaused) return;
    
    const hasBeats = pattern.some(track => track.some(beat => beat));
    if (!hasBeats) {
      toast.error("Add some beats to your pattern first!");
      return;
    }

    try {
      setIsExporting(true);
      toast.info("Recording your beat... This will take a few seconds");

      // Create a destination for recording
      const dest = audioContextRef.current.createMediaStreamDestination();
      const mediaRecorder = new MediaRecorder(dest.stream);
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/wav" });
        const url = URL.createObjectURL(audioBlob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `beat-${bpm}bpm-${Date.now()}.wav`;
        a.click();
        URL.revokeObjectURL(url);
        setIsExporting(false);
        toast.success("Beat exported successfully!");
      };

      mediaRecorder.start();

      // Play through the pattern twice for the recording
      let recordStep = 0;
      const totalSteps = STEPS * 2; // Record 2 loops
      const stepDuration = (60 / bpm / 4) * 1000;

      const recordInterval = setInterval(() => {
        const currentBeat = recordStep % STEPS;
        
        pattern.forEach((track, instrumentIndex) => {
          if (track[currentBeat]) {
            // Create oscillators that connect to the recording destination
            const ctx = audioContextRef.current!;
            const now = ctx.currentTime;

            switch (instrumentIndex) {
              case 0: // Kick
                const kickOsc = ctx.createOscillator();
                const kickGain = ctx.createGain();
                kickOsc.frequency.setValueAtTime(150, now);
                kickOsc.frequency.exponentialRampToValueAtTime(0.01, now + 0.5);
                kickGain.gain.setValueAtTime(1, now);
                kickGain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
                kickOsc.connect(kickGain).connect(dest);
                kickOsc.start(now);
                kickOsc.stop(now + 0.5);
                break;

              case 1: // Snare
                const snareOsc = ctx.createOscillator();
                const snareGain = ctx.createGain();
                snareOsc.type = "triangle";
                snareOsc.frequency.setValueAtTime(200, now);
                snareGain.gain.setValueAtTime(0.3, now);
                snareGain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
                snareOsc.connect(snareGain).connect(dest);
                snareOsc.start(now);
                snareOsc.stop(now + 0.2);
                break;

              case 2: // Hi-Hat
                const hihatOsc = ctx.createOscillator();
                const hihatGain = ctx.createGain();
                hihatOsc.type = "square";
                hihatOsc.frequency.setValueAtTime(8000, now);
                hihatGain.gain.setValueAtTime(0.1, now);
                hihatGain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
                hihatOsc.connect(hihatGain).connect(dest);
                hihatOsc.start(now);
                hihatOsc.stop(now + 0.1);
                break;

              case 3: // Clap
                const clapOsc = ctx.createOscillator();
                const clapGain = ctx.createGain();
                clapOsc.type = "sawtooth";
                clapOsc.frequency.setValueAtTime(1000, now);
                clapGain.gain.setValueAtTime(0.2, now);
                clapGain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
                clapOsc.connect(clapGain).connect(dest);
                clapOsc.start(now);
                clapOsc.stop(now + 0.15);
                break;
            }
          }
        });

        recordStep++;
        if (recordStep >= totalSteps) {
          clearInterval(recordInterval);
          setTimeout(() => {
            mediaRecorder.stop();
          }, 500);
        }
      }, stepDuration);

    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export beat. Please try again.");
      setIsExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-3 sm:p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold sm:text-5xl bg-gradient-to-r from-primary via-accent to-secondary bg-clip-text text-transparent">
            Beat Generator
          </h1>
          <p className="text-muted-foreground text-lg">
            Create amazing beats with the power of Web Audio API
          </p>
        </div>

        {/* Controls */}
        <Card className="p-4 sm:p-6 bg-card border-border">
          <div className="flex flex-col md:flex-row gap-6 items-center justify-between">
            <div className="flex gap-3">
              <Button
                onClick={togglePlay}
                disabled={!isPlayableReady || isSystemPaused}
                size="lg"
                className="bg-primary hover:bg-primary/90 shadow-[0_0_20px_hsl(var(--primary)/0.5)] transition-all"
              >
                {isPlaying ? <Pause className="mr-2" /> : <Play className="mr-2" />}
                {isPlaying ? "Pause" : "Play"}
              </Button>
              <Button
                onClick={clearPattern}
                disabled={!isPlayableReady || isSystemPaused}
                variant="outline"
                size="lg"
                className="border-border hover:bg-muted"
              >
                <Square className="mr-2" />
                Clear
              </Button>
            </div>

            <div className="flex flex-col md:flex-row gap-6 items-center w-full md:w-auto">
              <div className="flex items-center gap-4 w-full md:w-64">
                <span className="text-sm font-medium whitespace-nowrap">BPM: {bpm}</span>
                <Slider
                  value={[bpm]}
                  onValueChange={(value) => setBpm(value[0])}
                  disabled={!isPlayableReady || isSystemPaused}
                  min={60}
                  max={200}
                  step={1}
                  className="flex-1"
                />
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={randomizePattern}
                  disabled={!isPlayableReady || isSystemPaused}
                  variant="outline"
                  className="border-secondary text-secondary hover:bg-secondary/10"
                >
                  <Shuffle className="mr-2" />
                  Random
                </Button>
                <Button
                  onClick={exportPattern}
                  disabled={isExporting || !isPlayableReady || isSystemPaused}
                  variant="outline"
                  className="border-accent text-accent hover:bg-accent/10 disabled:opacity-50"
                >
                  <Download className="mr-2" />
                  {isExporting ? "Exporting..." : "Export"}
                </Button>
              </div>
            </div>
          </div>
        </Card>

        {/* Beat Grid */}
        <Card className="p-3 sm:p-6 bg-card border-border">
          <div className="space-y-4">
            {INSTRUMENTS.map((instrument, instrumentIndex) => (
              <div key={instrument.name} className="space-y-2 sm:flex sm:items-center sm:gap-4 sm:space-y-0">
                <div
                  className="text-sm font-medium sm:w-20 sm:text-right"
                  style={{ color: instrument.color }}
                >
                  {instrument.name}
                </div>
                <div className="grid w-full grid-cols-4 gap-2 sm:grid-cols-8 md:[grid-template-columns:repeat(16,minmax(0,1fr))]">
                  {Array.from({ length: STEPS }).map((_, stepIndex) => (
                    <button
                      key={stepIndex}
                      onClick={() => toggleBeat(instrumentIndex, stepIndex)}
                      disabled={!isPlayableReady || isSystemPaused}
                      className={`
                        aspect-square min-h-12 rounded-md transition-all duration-150 sm:min-h-[40px]
                        ${pattern[instrumentIndex][stepIndex]
                          ? "opacity-100 shadow-lg"
                          : "opacity-30 hover:opacity-50"
                        }
                        ${currentStep === stepIndex && isPlaying
                          ? "ring-2 ring-white scale-110"
                          : ""
                        }
                      `}
                      style={{
                        backgroundColor: instrument.color,
                        boxShadow: pattern[instrumentIndex][stepIndex]
                          ? `0 0 15px ${instrument.color}`
                          : "none",
                      }}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};
