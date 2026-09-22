import { useEffect, useRef } from "react";

interface SoundscapeVisualizerProps {
  isPlaying: boolean;
  bpm: number;
  currentStep: number;
  isAudioEnabled: boolean;
}

export const SoundscapeVisualizer = ({
  isPlaying,
  bpm,
  currentStep,
  isAudioEnabled,
}: SoundscapeVisualizerProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const phaseRef = useRef(0);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = (canvas.width = canvas.offsetWidth * window.devicePixelRatio);
    let height = (canvas.height = canvas.offsetHeight * window.devicePixelRatio);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      height = canvas.height = canvas.offsetHeight * window.devicePixelRatio;
    };
    window.addEventListener("resize", handleResize);

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Animation speed scaled by BPM and playback state
      const speed = isPlaying ? (bpm / 120) * 0.045 : 0.012;
      phaseRef.current += speed;
      const phase = phaseRef.current;

      const lines = [
        {
          color: "rgba(168, 85, 247, 0.75)", // Neon Purple
          glow: "rgba(168, 85, 247, 0.4)",
          amplitude: isPlaying && isAudioEnabled ? height * 0.32 : height * 0.08,
          frequency: 0.012,
          phaseOffset: 0,
        },
        {
          color: "rgba(56, 189, 248, 0.7)", // Neon Cyan
          glow: "rgba(56, 189, 248, 0.4)",
          amplitude: isPlaying && isAudioEnabled ? height * 0.26 : height * 0.06,
          frequency: 0.018,
          phaseOffset: 1.4,
        },
        {
          color: "rgba(244, 114, 182, 0.65)", // Neon Pink
          glow: "rgba(244, 114, 182, 0.35)",
          amplitude: isPlaying && isAudioEnabled ? height * 0.22 : height * 0.05,
          frequency: 0.024,
          phaseOffset: 2.8,
        },
      ];

      lines.forEach(({ color, amplitude, frequency, phaseOffset }) => {
        ctx.beginPath();
        ctx.lineWidth = 2 * window.devicePixelRatio;
        ctx.strokeStyle = color;

        // Step pulse distortion when beats hit
        const stepPulse = isPlaying ? Math.sin((currentStep / 16) * Math.PI * 2) * 0.15 : 0;

        for (let x = 0; x < width; x += 4) {
          const normalX = x / width;
          // Smooth envelope dampening at canvas edges
          const envelope = Math.sin(normalX * Math.PI);
          const y =
            height / 2 +
            Math.sin(x * frequency + phase + phaseOffset) * amplitude * envelope * (1 + stepPulse);

          if (x === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();
      });

      animFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener("resize", handleResize);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying, bpm, currentStep, isAudioEnabled]);

  return (
    <div className="apple-visualizer-wrap" aria-hidden="true">
      <canvas ref={canvasRef} className="apple-visualizer-canvas" />
    </div>
  );
};
