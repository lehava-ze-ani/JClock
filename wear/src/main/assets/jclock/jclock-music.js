import { BackgroundMusic } from "../game_loop/background_music.js?v=20260709-audio3";

const STORAGE_KEY = "book-of-numbers-js:jclock-volume";
const DEFAULT_VOLUME = 0.42;
const TAP_IGNORE_SELECTOR = "#date-orbit, .jclock-music-controls, .jclock-volume-control, .hidden-starr-panel, button, input, select, textarea, a";
const params = new URLSearchParams(window.location.search);
const embeddedMuted = params.get("embedded") === "1" && params.get("muted") !== "0";
const launchVolume =
  params.get("jclockVolume") || params.get("musicVolume") || params.get("melodyVolume") || params.get("volume") || "";
const volumeInput = document.querySelector("#jclock-music-volume");
const volumeOutput = document.querySelector("#jclock-music-volume-value");
const importWavButton = document.querySelector("#jclock-import-wav");
const importWavInput = document.querySelector("#jclock-wav-file-input");
const musicProgress = document.querySelector("#jclock-music-progress");
const musicProgressLabel = document.querySelector("#jclock-music-progress-label");
const musicProgressValue = document.querySelector("#jclock-music-progress-value");
const musicProgressBar = document.querySelector("#jclock-music-progress-bar");
const musicProgressFill = document.querySelector("#jclock-music-progress-fill");
const rootElement = document.documentElement;
let importProgressClearTimer = 0;

function clampPercent(value) {
  const percent = Number(value);
  if (!Number.isFinite(percent)) return 0;
  return Math.max(0, Math.min(100, Math.round(percent)));
}

function setMusicProgress({ active = false, value = 0, label = "טוען שיר" } = {}) {
  if (!musicProgress) return;

  const percent = clampPercent(value);
  musicProgress.hidden = !active;
  musicProgress.dataset.active = active ? "true" : "false";
  if (musicProgressLabel) musicProgressLabel.textContent = label;
  if (musicProgressValue) musicProgressValue.textContent = `${percent}%`;
  if (musicProgressFill) musicProgressFill.style.inlineSize = `${percent}%`;
  if (musicProgressBar) {
    musicProgressBar.setAttribute("aria-valuenow", String(percent));
    musicProgressBar.setAttribute("aria-label", label);
  }
}

function clearImportProgressTimer() {
  if (!importProgressClearTimer) return;
  window.clearTimeout(importProgressClearTimer);
  importProgressClearTimer = 0;
}

function scheduleHideMusicProgress(delay = 700) {
  clearImportProgressTimer();
  importProgressClearTimer = window.setTimeout(() => {
    importProgressClearTimer = 0;
    setMusicProgress({ active: false });
  }, delay);
}

function musicProgressLabelFor(kind, state) {
  if (kind === "manifest") return "טוען רשימת שירים";
  if (kind === "audio-context") return "מפענח שיר";
  if (state === "buffering") return "ממשיך לטעון";
  return "טוען שיר";
}

function nextFrame() {
  return new Promise((resolve) => window.requestAnimationFrame(() => resolve()));
}

function updateMusicState(debug) {
  if (!rootElement || !debug) return;
  rootElement.dataset.musicState = debug.state || "";
  rootElement.dataset.musicPaused = debug.pausedByUser ? "true" : "false";
  rootElement.dataset.musicPreloadAllowed = debug.preloadAllowed ? "true" : "false";
  rootElement.dataset.localMelodyCount = String(debug.localTrackCount || 0);
  if (importWavButton) {
    importWavButton.dataset.hasLocalTracks = debug.localTrackCount ? "true" : "false";
  }
  const progress = debug.loadProgress || {};
  if (progress.active) {
    clearImportProgressTimer();
    setMusicProgress({
      active: true,
      value: progress.value,
      label: musicProgressLabelFor(progress.kind, debug.state)
    });
  } else if (!importProgressClearTimer) {
    setMusicProgress({ active: false });
  }
}

const backgroundMusic = new BackgroundMusic({
  volume: DEFAULT_VOLUME,
  onStateChange: updateMusicState,
  keepAlive: true,
  trackGapMs: 6000,
  mediaSession: {
    title: "JClock Melody",
    artist: "Book of Numbers",
    album: "JClock"
  }
});

function normalizeVolume(value, fallback = DEFAULT_VOLUME) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  const normalized = number > 1 ? number / 100 : number;
  return Math.max(0, Math.min(normalized, 1));
}

function initialVolume() {
  if (embeddedMuted) return 0;
  if (launchVolume) return normalizeVolume(launchVolume);
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? normalizeVolume(saved) : DEFAULT_VOLUME;
  } catch {
    return DEFAULT_VOLUME;
  }
}

let selectedVolume = initialVolume();
let lastGestureStartAt = 0;
let lastTapToggleAt = 0;

function syncVolumeControl() {
  const percent = Math.round(selectedVolume * 100);
  if (volumeInput) volumeInput.value = String(percent);
  if (volumeOutput) volumeOutput.textContent = `${percent}%`;
}

function setMusicVolume(value, { persist = false } = {}) {
  selectedVolume = embeddedMuted ? 0 : normalizeVolume(value, selectedVolume);
  backgroundMusic.setVolume(selectedVolume);
  syncVolumeControl();
  if (persist) {
    try {
      localStorage.setItem(STORAGE_KEY, String(selectedVolume));
    } catch {
      // Volume still changes for the current page even when storage is unavailable.
    }
  }
  return selectedVolume;
}

function startMusic() {
  backgroundMusic.setVolume(selectedVolume);
  backgroundMusic.start();
  updateMusicState(backgroundMusic.getDebugState());
}

function startMusicFromGesture() {
  const now = performance.now();
  if (now - lastGestureStartAt < 500) return;
  lastGestureStartAt = now;
  startMusic();
  window.setTimeout(() => backgroundMusic.tryPlay(), 0);
  window.setTimeout(() => backgroundMusic.tryPlay(), 250);
}

function shouldIgnoreTap(event) {
  const target = event.target;
  return target instanceof Element && Boolean(target.closest(TAP_IGNORE_SELECTOR));
}

function toggleMusicFromTap(event) {
  if (shouldIgnoreTap(event)) return;
  const now = performance.now();
  if (now - lastTapToggleAt < 350) return;
  lastTapToggleAt = now;
  backgroundMusic.setVolume(selectedVolume);
  backgroundMusic.togglePause();
  updateMusicState(backgroundMusic.getDebugState());
}

updateMusicState(backgroundMusic.getDebugState());
setMusicVolume(selectedVolume);
backgroundMusic.prepare().then(() => startMusic());
window.setInterval(() => backgroundMusic.update(), 30000);
volumeInput?.addEventListener("input", () => {
  setMusicVolume(volumeInput.value, { persist: true });
  backgroundMusic.start();
});
importWavButton?.addEventListener("click", () => {
  importWavInput?.click();
});
importWavInput?.addEventListener("change", async () => {
  const files = Array.from(importWavInput.files || []);
  if (files.length) {
    clearImportProgressTimer();
    setMusicProgress({ active: true, value: 4, label: "מייבא WAV" });
    await nextFrame();
  }
  let processed = 0;
  const acceptedFiles = [];
  const rejectedFiles = [];
  for (const file of files) {
    processed += 1;
    const isWav =
      /\.wav$/i.test(file.name || "") &&
      (!file.type || ["audio/wav", "audio/wave", "audio/x-wav", "audio/vnd.wave"].includes(file.type.toLowerCase()));
    if (isWav) acceptedFiles.push(file);
    else rejectedFiles.push(file);
    setMusicProgress({
      active: true,
      value: files.length ? (processed / files.length) * 72 : 0,
      label: "מייבא WAV"
    });
    await nextFrame();
  }

  const result = backgroundMusic.addLocalAudioFiles(acceptedFiles);
  importWavInput.value = "";
  updateMusicState(backgroundMusic.getDebugState());
  if (files.length) {
    const doneLabel = result.added
      ? "הייבוא הסתיים"
      : (rejectedFiles.length ? "לא נוסף WAV" : "הקובץ כבר קיים");
    setMusicProgress({ active: true, value: 100, label: doneLabel });
    scheduleHideMusicProgress();
  }
  if (result.added && backgroundMusic.playRequested) {
    backgroundMusic.tryPlay();
  }
});
window.addEventListener("pointerup", toggleMusicFromTap, { capture: true, passive: true });
window.addEventListener("click", toggleMusicFromTap, { capture: true });
window.addEventListener("keydown", startMusicFromGesture, { capture: true });

globalThis.__jclockMusic = backgroundMusic;
globalThis.__jclockStartMusic = startMusicFromGesture;
globalThis.__jclockSetMusicVolume = (value) => {
  return setMusicVolume(value, { persist: true });
};
