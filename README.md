# Beat Studio

> An Apple-inspired, touch-friendly 16-step soundscape maker with a live WebGL signal visualizer.

Beat Studio is a calm, expressive place to build a beat, shape it in real time, and save the idea before it disappears. The interface uses layered glass, clear hierarchy, and responsive controls to keep the focus on making music.

| Build | Shape | Keep |
| :-- | :-- | :-- |
| Kick, Snare, Hi-Hat, Clap, Bass, and Shaker patterns | BPM, swing, velocity, track level, mute, and solo | Named presets, favorites, share links, and JSON import/export |

## Highlights

- **Native WebGL visualizer** — a GPU-rendered signal sculpture responds to the active step, playback state, and velocity.
- **Designed to start musical** — the sequencer opens with an audible starter groove; tap Play once to unlock browser audio.
- **Precise control** — use the 16-step grid, rich keyboard shortcuts, responsive mixer, and fluid controls across phone and desktop.
- **Portable creations** — save presets locally or with the YouTube Playables save adapter, share a beat URL, and import/export JSON.
- **No monetization** — no ads, rewarded content, purchases, or artificial score mechanics are included.

## Keyboard controls

| Key | Action |
| :-- | :-- |
| `Space` | Play / pause |
| `←` / `→` | Select a step |
| `1`–`6` | Toggle the selected step on a track |
| `M` | Toggle master audio |
| `F` | Toggle fullscreen |

## Run locally

```bash
git clone https://github.com/Rahul08319/random-soundscape-maker.git
cd random-soundscape-maker
npm install
npm run dev
```

Create the production bundle with:

```bash
npm run build
```

## Architecture

```text
src/components/BeatStudio.tsx       Sequencer, Web Audio engine, controls, and presets
src/components/BeatVisualizer.tsx  Native WebGL live visualizer
src/lib/platform/                  Host lifecycle, audio, locale, and save adapters
.github/workflows/verify.yml       Deterministic production-build verification
```

Built with React, TypeScript, Vite, Tailwind CSS, Web Audio API, and WebGL.

## YouTube Playables

The YouTube adapter loads before the app bundle, reports first-frame and game readiness, honors host audio and pause/resume signals, uses the host language, and persists the beat with the Playables save API. Local development falls back to `localStorage`.

Before a submission, upload a production bundle to the official [YouTube Playables Test Suite](https://developers.google.com/youtube/gaming/playables/test_suite). GitHub Actions installs the locked dependencies and verifies the production build on every push and pull request.

---

Made with care by [Rahul Kumar](https://github.com/Rahul08319).
