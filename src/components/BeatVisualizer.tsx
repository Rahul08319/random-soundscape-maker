import { useEffect, useRef } from "react";

type BeatVisualizerProps = { isPlaying: boolean; currentStep: number; velocity: number };

const vertexShader = `attribute vec2 a_position; void main() { gl_Position = vec4(a_position, 0.0, 1.0); }`;
const fragmentShader = `
  precision mediump float;
  uniform vec2 u_resolution; uniform float u_time; uniform float u_energy; uniform float u_step;
  void main() {
    vec2 uv = (gl_FragCoord.xy * 2.0 - u_resolution.xy) / min(u_resolution.x, u_resolution.y);
    float radius = length(uv); float angle = atan(uv.y, uv.x);
    float ripple = sin(radius * 19.0 - u_time * 2.7 + u_step * 0.39) * 0.035;
    float core = smoothstep(0.87 + ripple, 0.18, radius);
    float ring = smoothstep(0.06, 0.0, abs(radius - 0.63 - sin(angle * 3.0 + u_time) * 0.035));
    float halo = smoothstep(1.4, 0.15, radius) * 0.35;
    vec3 violet = vec3(0.46, 0.24, 1.0); vec3 cyan = vec3(0.18, 0.84, 1.0); vec3 pink = vec3(1.0, 0.35, 0.69);
    float sweep = sin(angle * 2.0 - u_time * 0.55) * 0.5 + 0.5;
    vec3 color = mix(violet, cyan, sweep);
    color = mix(color, pink, smoothstep(0.55, 1.0, sin(angle * 4.0 + u_time * 0.7) * 0.5 + 0.5) * 0.34);
    color *= core * (0.68 + u_energy * 0.72) + ring * 1.15 + halo;
    gl_FragColor = vec4(color, min(1.0, core * 0.88 + ring + halo));
  }
`;

const compileShader = (gl: WebGLRenderingContext, type: number, source: string) => {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source); gl.compileShader(shader);
  return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null;
};

/** A dependency-free, GPU-rendered visual companion for the beat sequencer. */
export const BeatVisualizer = ({ isPlaying, currentStep, velocity }: BeatVisualizerProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({ isPlaying, currentStep, velocity });
  useEffect(() => { stateRef.current = { isPlaying, currentStep, velocity }; }, [currentStep, isPlaying, velocity]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const gl = canvas?.getContext("webgl", { alpha: true, antialias: true, powerPreference: "low-power" });
    if (!canvas || !gl) { canvas?.setAttribute("data-webgl", "unavailable"); return undefined; }
    const vertex = compileShader(gl, gl.VERTEX_SHADER, vertexShader);
    const fragment = compileShader(gl, gl.FRAGMENT_SHADER, fragmentShader);
    if (!vertex || !fragment) { canvas.setAttribute("data-webgl", "unavailable"); return undefined; }
    const program = gl.createProgram();
    if (!program) return undefined;
    gl.attachShader(program, vertex); gl.attachShader(program, fragment); gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return undefined;
    gl.useProgram(program);
    const position = gl.getAttribLocation(program, "a_position"); const resolution = gl.getUniformLocation(program, "u_resolution");
    const time = gl.getUniformLocation(program, "u_time"); const energy = gl.getUniformLocation(program, "u_energy"); const step = gl.getUniformLocation(program, "u_step");
    const buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    const resize = () => { const ratio = Math.min(window.devicePixelRatio || 1, 1.5); canvas.width = Math.max(1, Math.floor(canvas.clientWidth * ratio)); canvas.height = Math.max(1, Math.floor(canvas.clientHeight * ratio)); gl.viewport(0, 0, canvas.width, canvas.height); };
    const observer = new ResizeObserver(resize); observer.observe(canvas); resize(); canvas.setAttribute("data-webgl", "ready");
    let frame = 0;
    const render = (now: number) => { const current = stateRef.current; gl.uniform2f(resolution, canvas.width, canvas.height); gl.uniform1f(time, now * 0.001); gl.uniform1f(energy, current.isPlaying ? current.velocity : 0.08); gl.uniform1f(step, current.currentStep); gl.drawArrays(gl.TRIANGLES, 0, 6); frame = window.requestAnimationFrame(render); };
    frame = window.requestAnimationFrame(render);
    return () => { window.cancelAnimationFrame(frame); observer.disconnect(); gl.deleteBuffer(buffer); gl.deleteProgram(program); gl.deleteShader(vertex); gl.deleteShader(fragment); };
  }, []);
  return <div className="beat-visualizer" aria-label="Live WebGL beat visualizer"><canvas ref={canvasRef} /></div>;
};
