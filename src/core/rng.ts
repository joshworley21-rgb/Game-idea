/** Small deterministic PRNG (mulberry32) so a seed replays identically. */
export class Rng {
  private s: number;

  constructor(seed: number) {
    this.s = seed >>> 0;
  }

  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Uniform float in [min, max). */
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length)];
  }

  /** Weighted pick. Returns null when every weight is zero. */
  weighted<T>(items: readonly T[], weight: (item: T) => number): T | null {
    let total = 0;
    for (const it of items) total += Math.max(0, weight(it));
    if (total <= 0) return null;
    let roll = this.next() * total;
    for (const it of items) {
      roll -= Math.max(0, weight(it));
      if (roll <= 0) return it;
    }
    return items[items.length - 1] ?? null;
  }

  get state(): number {
    return this.s;
  }

  set state(v: number) {
    this.s = v >>> 0;
  }
}
