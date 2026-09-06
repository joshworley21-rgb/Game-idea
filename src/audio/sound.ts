import * as THREE from "three";

/**
 * All of the game's audio is synthesised at runtime with the Web Audio API.
 * Nothing is sampled, so the whole soundscape costs no download, no licence
 * and no asset pipeline — which matters when the game ships as one HTML file
 * and a small APK.
 */

const MUTE_KEY = "oval.muted.v1";

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

/** Two seconds of noise, shaped toward the low end so it reads as air, not hiss. */
function makeNoise(ctx: BaseAudioContext): AudioBuffer {
  const length = ctx.sampleRate * 2;
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < length; i += 1) {
    const white = Math.random() * 2 - 1;
    // A one-pole lowpass turns white noise into something closer to brown.
    last = (last + 0.02 * white) / 1.02;
    data[i] = last * 3.2;
  }
  return buffer;
}

export class Sound {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private noise!: AudioBuffer;
  private started = false;
  private muted = readMuted();
  /** Absolute audio-context times for the next tick and the next crackle. */
  private nextTick = 0;
  private nextCrackle = 0;
  private stepDistance = 0;
  private tickTarget: GainNode | null = null;
  private fireTarget: GainNode | null = null;
  onMuteChange: (muted: boolean) => void = () => {};

  get isMuted(): boolean {
    return this.muted;
  }

  /**
   * Browsers only allow audio to start from a user gesture, so this is called
   * from the first click rather than at load.
   */
  start(listener: THREE.AudioListener): void {
    if (this.started) return;
    this.started = true;
    this.ctx = THREE.AudioContext.getContext() as AudioContext;
    void this.ctx.resume();

    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.9;
    this.master.connect(listener.getInput());
    this.noise = makeNoise(this.ctx);
    this.nextTick = this.ctx.currentTime + 1;
    this.nextCrackle = this.ctx.currentTime + 0.4;

    this.roomTone();
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    try {
      localStorage.setItem(MUTE_KEY, this.muted ? "1" : "0");
    } catch {
      /* storage unavailable; the preference just won't persist */
    }
    if (this.ctx) {
      this.master.gain.setTargetAtTime(this.muted ? 0 : 0.9, this.ctx.currentTime, 0.05);
    }
    this.onMuteChange(this.muted);
    return this.muted;
  }

  // ------------------------------------------------------------- primitives

  /** A shaped sine or triangle tone. The workhorse behind every UI sound. */
  private tone(
    freq: number,
    duration: number,
    gain: number,
    type: OscillatorType = "sine",
    delay = 0,
    endFreq?: number,
  ): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, t + duration);
    // A short attack avoids the click you get from starting at full amplitude.
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(gain, t + Math.min(0.02, duration * 0.2));
    env.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(env).connect(this.master);
    osc.start(t);
    osc.stop(t + duration + 0.05);
  }

  /** A burst of filtered noise: footsteps, paper, the crackle of a fire. */
  private burst(
    freq: number,
    duration: number,
    gain: number,
    q = 1,
    delay = 0,
    destination?: AudioNode,
  ): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = freq;
    filter.Q.value = q;
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(gain, t + 0.008);
    env.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    src.connect(filter).connect(env).connect(destination ?? this.master);
    src.start(t, Math.random() * 1.5);
    src.stop(t + duration + 0.05);
  }

  // ---------------------------------------------------------------- ambience

  /** The barely-there hum of a large, quiet room. */
  private roomTone(): void {
    if (!this.ctx) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 320;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.035;
    src.connect(filter).connect(gain).connect(this.master);
    src.start();
  }

  /**
   * Anchors the fire and the clock to their places in the room, so both fade
   * as you walk away from them and the office has a sense of space.
   */
  attachRoom(listener: THREE.AudioListener, fireplace: THREE.Object3D, clock: THREE.Object3D): void {
    if (!this.ctx) return;

    // The fire is a filtered noise bed; its crackles are scheduled in update().
    const fireBed = this.ctx.createBufferSource();
    fireBed.buffer = this.noise;
    fireBed.loop = true;
    const fireFilter = this.ctx.createBiquadFilter();
    fireFilter.type = "lowpass";
    fireFilter.frequency.value = 620;
    this.fireTarget = this.ctx.createGain();
    this.fireTarget.gain.value = 0.5;
    fireBed.connect(fireFilter).connect(this.fireTarget);
    fireBed.start();
    fireplace.add(this.positional(listener, this.fireTarget, 1.6, 1.8, 0.55));

    // The clock has no bed at all: it is silent between ticks.
    this.tickTarget = this.ctx.createGain();
    this.tickTarget.gain.value = 1;
    clock.add(this.positional(listener, this.tickTarget, 1.1, 2.4, 0.9));
  }

  /** Wraps an audio node in a three.js positional source at the default origin. */
  private positional(
    listener: THREE.AudioListener,
    node: AudioNode,
    refDistance: number,
    rolloff: number,
    volume: number,
  ): THREE.PositionalAudio {
    const source = new THREE.PositionalAudio(listener);
    // setNodeSource takes any AudioNode; the typings only name one of them.
    source.setNodeSource(node as AudioBufferSourceNode);
    source.setRefDistance(refDistance);
    source.setRolloffFactor(rolloff);
    source.setVolume(volume);
    return source;
  }

  /**
   * Drives the clock, the fire and footsteps, called once per frame.
   *
   * Timing comes from the audio clock rather than accumulated frame deltas.
   * The render loop clamps its delta to stop the player teleporting after a
   * tab switch, which would otherwise make a slow device tick in slow motion.
   * Footsteps stay distance-based, so they land with the walking.
   */
  update(movedBy: number): void {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;

    if (now >= this.nextTick) {
      this.nextTick = now + 1;
      // Alternating tick and tock, so it reads as a pendulum rather than a beep.
      const high = Math.round(now) % 2 === 0;
      this.burst(high ? 2600 : 2100, 0.045, 0.5, 6, 0, this.tickTarget ?? undefined);
    }

    if (now >= this.nextCrackle) {
      this.nextCrackle = now + 0.25 + Math.random() * 1.4;
      this.burst(
        700 + Math.random() * 1500,
        0.05 + Math.random() * 0.09,
        0.5 + Math.random() * 0.5,
        3,
        0,
        this.fireTarget ?? undefined,
      );
    }

    this.stepDistance += movedBy;
    if (this.stepDistance >= 0.78) {
      this.stepDistance = 0;
      this.burst(320 + Math.random() * 120, 0.09, 0.05, 1.2);
    }
  }

  // --------------------------------------------------------------- UI sounds

  click(): void { this.tone(1180, 0.04, 0.05, "sine"); }
  openPanel(): void { this.tone(440, 0.09, 0.05); this.tone(660, 0.12, 0.04, "sine", 0.05); }
  closePanel(): void { this.tone(560, 0.08, 0.04); this.tone(400, 0.11, 0.03, "sine", 0.045); }

  /** A warm major arpeggio: a bill signed, a budget passed. */
  good(): void {
    [523.25, 659.25, 783.99].forEach((f, i) => this.tone(f, 0.5, 0.055, "triangle", i * 0.07));
  }

  /** Descending and minor: a bill dead on the floor. */
  bad(): void {
    [392, 329.63, 261.63].forEach((f, i) => this.tone(f, 0.55, 0.055, "triangle", i * 0.09));
  }

  /** Two urgent pulses. Something is on fire and it is your problem. */
  alert(): void {
    this.tone(330, 0.16, 0.06, "square", 0, 300);
    this.tone(247, 0.24, 0.06, "square", 0.2, 220);
  }

  /** A soft bell to close the month. */
  chime(): void {
    this.tone(587.33, 1.5, 0.05, "sine");
    this.tone(1174.66, 1.1, 0.018, "sine", 0.01);
  }

  /** Paper and pen: an action taken at the desk. */
  paper(): void {
    this.burst(2400, 0.14, 0.03, 0.8);
    this.burst(1800, 0.1, 0.025, 0.8, 0.09);
  }
}
