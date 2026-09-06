# Beat Studio

An expressive, touch-friendly 16-step beat sequencer for making quick loops, saving ideas, and sharing a groove. Built as a compact web experience with YouTube Playables support in mind.

## What you can do

- Program six colorful tracks: Kick, Snare, Hi-Hat, Clap, Bass, and Shaker.
- Control tempo, swing, velocity, per-track volume, mute, and solo.
- Play, clear, and generate a fresh randomized groove.
- Save named presets, mark favorites, and restore them later.
- Copy a shareable beat link or export/import your whole session as JSON.
- Use the keyboard: `Space` play/pause, `←`/`→` select a step, `1`–`6` toggle a track, `F` fullscreen.

## Run locally

```sh
git clone https://github.com/Rahul08319/random-soundscape-maker.git
cd random-soundscape-maker
npm install
npm run dev
```

## Tech

React · TypeScript · Vite · Tailwind CSS · shadcn/ui · Web Audio API

## YouTube Playables readiness

Beat Studio integrates the YouTube Playables web SDK before the app bundle and reports first-frame and interactive readiness. It responds to host audio and pause/resume events, uses the host language, and persists a session through Playables cloud save with a local-storage fallback during local development.

The project deliberately contains no ads, rewarded ads, or monetization flows. It also has no score or YouTube content deep link because neither applies to a creative music editor.

Run the production checks with:

```sh
npm run lint
npm run build
```

GitHub Actions runs those same checks for pushes and pull requests. Final approval still requires uploading a production build to the official [YouTube Playables Test Suite](https://developers.google.com/youtube/gaming/playables/test_suite).

## Project structure

```text
src/components/BeatStudio.tsx  Main sequencer and mixer
src/lib/youtubePlayables.ts    YouTube Playables lifecycle and save adapter
.github/workflows/verify.yml   Build and lint checks
```

Made by [Rahul Kumar](https://github.com/Rahul08319).
