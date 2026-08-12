export type MusicTheme = "menu" | "placement" | "battle" | "result";

interface ThemePattern {
  bpm: number;
  rootMidi: number;
  lead: readonly (number | null)[];
  bass: readonly (number | null)[];
  leadWave: OscillatorType;
}

const STORAGE_KEY = "catapult-duel.music-muted";
const MASTER_VOLUME = 0.16;
const STEP_LOOKAHEAD_SECONDS = 0.22;

const THEMES: Record<MusicTheme, ThemePattern> = {
  menu: {
    bpm: 92,
    rootMidi: 45,
    lead: [12, null, 19, null, 16, null, 14, null, 12, null, 16, null, 19, 16, 14, null],
    bass: [0, null, null, null, 7, null, null, null, 5, null, null, null, 3, null, 5, null],
    leadWave: "square",
  },
  placement: {
    bpm: 106,
    rootMidi: 43,
    lead: [12, null, 15, 17, null, 15, 12, null, 19, null, 17, 15, 12, null, 10, null],
    bass: [0, null, 0, null, 5, null, 5, null, 7, null, 7, null, 3, null, 5, null],
    leadWave: "square",
  },
  battle: {
    bpm: 132,
    rootMidi: 40,
    lead: [12, null, 15, 12, 19, null, 17, 15, 12, 15, 17, null, 10, 12, 15, null],
    bass: [0, null, 0, 0, 5, null, 5, 5, 7, null, 7, 7, 3, null, 5, 7],
    leadWave: "sawtooth",
  },
  result: {
    bpm: 86,
    rootMidi: 45,
    lead: [12, 16, 19, 24, null, 19, 16, 12, 17, 21, 24, null, 19, 21, 24, null],
    bass: [0, null, null, null, 5, null, null, null, 7, null, null, null, 5, null, 7, null],
    leadWave: "square",
  },
};

function midiToFrequency(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

class MusicController {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private theme: MusicTheme = "menu";
  private step = 0;
  private nextStepTime = 0;
  private muted = this.readMutedPreference();
  private unlockInstalled = false;
  private readonly activeSources = new Set<AudioScheduledSourceNode>();
  private readonly listeners = new Set<(muted: boolean) => void>();

  installAutoUnlock(): void {
    if (typeof window === "undefined" || this.unlockInstalled) {
      return;
    }

    this.unlockInstalled = true;
    window.addEventListener("pointerdown", this.handleFirstInteraction, {
      capture: true,
      once: true,
    });
    window.addEventListener("keydown", this.handleFirstInteraction, {
      capture: true,
      once: true,
    });
    document.addEventListener("visibilitychange", this.handleVisibilityChange);
  }

  setTheme(theme: MusicTheme): void {
    if (this.theme === theme) {
      return;
    }

    this.theme = theme;
    this.step = 0;
    if (!this.context || !this.masterGain) {
      return;
    }

    const now = this.context.currentTime;
    this.stopScheduledSources(now + 0.04);
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setValueAtTime(
      Math.max(0.0001, this.masterGain.gain.value),
      now,
    );
    this.masterGain.gain.linearRampToValueAtTime(0.0001, now + 0.12);
    this.masterGain.gain.linearRampToValueAtTime(
      this.muted ? 0.0001 : MASTER_VOLUME,
      now + 0.42,
    );
    this.nextStepTime = now + 0.16;
  }

  isMuted(): boolean {
    return this.muted;
  }

  async toggleMuted(): Promise<boolean> {
    await this.unlock();
    this.muted = !this.muted;
    this.writeMutedPreference();
    this.applyMasterVolume();
    this.listeners.forEach((listener) => listener(this.muted));
    return this.muted;
  }

  subscribe(listener: (muted: boolean) => void): () => void {
    this.listeners.add(listener);
    listener(this.muted);
    return () => this.listeners.delete(listener);
  }

  private readonly handleFirstInteraction = (): void => {
    void this.unlock();
  };

  private readonly handleVisibilityChange = (): void => {
    if (!this.context) {
      return;
    }

    if (document.hidden) {
      void this.context.suspend();
      return;
    }

    void this.context.resume().then(() => {
      if (this.context) {
        this.nextStepTime = this.context.currentTime + 0.06;
      }
    });
  };

  private async unlock(): Promise<void> {
    if (typeof window === "undefined" || !window.AudioContext) {
      return;
    }

    if (!this.context) {
      this.context = new window.AudioContext();
      this.masterGain = this.context.createGain();
      this.masterGain.gain.value = this.muted ? 0.0001 : MASTER_VOLUME;
      this.masterGain.connect(this.context.destination);
      this.nextStepTime = this.context.currentTime + 0.06;
      window.setInterval(() => this.schedule(), 50);
    }

    if (this.context.state === "suspended") {
      await this.context.resume();
      this.nextStepTime = this.context.currentTime + 0.06;
    }
  }

  private schedule(): void {
    if (!this.context || !this.masterGain || this.context.state !== "running") {
      return;
    }

    const pattern = THEMES[this.theme];
    const stepDuration = 60 / pattern.bpm / 2;
    const scheduleUntil = this.context.currentTime + STEP_LOOKAHEAD_SECONDS;

    while (this.nextStepTime < scheduleUntil) {
      this.scheduleStep(pattern, this.step, this.nextStepTime, stepDuration);
      this.step = (this.step + 1) % pattern.lead.length;
      this.nextStepTime += stepDuration;
    }
  }

  private scheduleStep(
    pattern: ThemePattern,
    step: number,
    time: number,
    stepDuration: number,
  ): void {
    const leadOffset = pattern.lead[step];
    const bassOffset = pattern.bass[step];

    if (leadOffset !== null && leadOffset !== undefined) {
      this.playNote(
        midiToFrequency(pattern.rootMidi + leadOffset),
        time,
        stepDuration * 0.72,
        pattern.leadWave,
        this.theme === "battle" ? 0.035 : 0.028,
      );
    }

    if (bassOffset !== null && bassOffset !== undefined) {
      this.playNote(
        midiToFrequency(pattern.rootMidi + bassOffset),
        time,
        stepDuration * 1.65,
        "triangle",
        0.055,
      );
    }

    if (step % 4 === 0) {
      this.playKick(time, this.theme === "battle" ? 0.09 : 0.055);
    }
    if (this.theme === "battle" && step % 2 === 1) {
      this.playNoiseTick(time, step % 4 === 3 ? 0.025 : 0.014);
    }
  }

  private playNote(
    frequency: number,
    time: number,
    duration: number,
    wave: OscillatorType,
    volume: number,
  ): void {
    if (!this.context || !this.masterGain) {
      return;
    }

    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = wave;
    oscillator.frequency.setValueAtTime(frequency, time);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(volume, time + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    oscillator.connect(gain);
    gain.connect(this.masterGain);
    this.trackSource(oscillator);
    oscillator.start(time);
    oscillator.stop(time + duration + 0.03);
  }

  private playKick(time: number, volume: number): void {
    if (!this.context || !this.masterGain) {
      return;
    }

    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(112, time);
    oscillator.frequency.exponentialRampToValueAtTime(42, time + 0.13);
    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.15);
    oscillator.connect(gain);
    gain.connect(this.masterGain);
    this.trackSource(oscillator);
    oscillator.start(time);
    oscillator.stop(time + 0.17);
  }

  private playNoiseTick(time: number, volume: number): void {
    if (!this.context || !this.masterGain) {
      return;
    }

    const buffer = this.context.createBuffer(
      1,
      Math.floor(this.context.sampleRate * 0.035),
      this.context.sampleRate,
    );
    const samples = buffer.getChannelData(0);
    for (let index = 0; index < samples.length; index += 1) {
      samples[index] = Math.random() * 2 - 1;
    }

    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    source.buffer = buffer;
    filter.type = "highpass";
    filter.frequency.value = 4200;
    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.035);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    this.trackSource(source);
    source.start(time);
  }

  private trackSource(source: AudioScheduledSourceNode): void {
    this.activeSources.add(source);
    source.addEventListener("ended", () => this.activeSources.delete(source), {
      once: true,
    });
  }

  private stopScheduledSources(time: number): void {
    this.activeSources.forEach((source) => {
      try {
        source.stop(time);
      } catch {
        // The source may already have finished between scheduling and cleanup.
      }
    });
    this.activeSources.clear();
  }

  private applyMasterVolume(): void {
    if (!this.context || !this.masterGain) {
      return;
    }

    const now = this.context.currentTime;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setTargetAtTime(
      this.muted ? 0.0001 : MASTER_VOLUME,
      now,
      0.035,
    );
  }

  private readMutedPreference(): boolean {
    try {
      return localStorage.getItem(STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  }

  private writeMutedPreference(): void {
    try {
      localStorage.setItem(STORAGE_KEY, String(this.muted));
    } catch {
      // Music still works when storage is unavailable.
    }
  }
}

export const musicController = new MusicController();
