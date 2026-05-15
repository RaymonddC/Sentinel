export interface RollingStatJSON {
  n: number;
  mean: number;
  m2: number;
  mMax: number;
}

// Welford's online mean/variance with optional decay cap. When the count
// exceeds mMax, the algorithm becomes equivalent to EWMA with α = 1/mMax.
// See research/09-rolling-stats-workaround.md.
export class RollingStat {
  static readonly M_MAX_HOURLY = 336;   // 14d × 24h
  static readonly M_MAX_5MIN = 4032;    // 14d × 288

  n: number;
  mean: number;
  m2: number;
  mMax: number;

  constructor(mMax: number = Number.POSITIVE_INFINITY) {
    this.n = 0;
    this.mean = 0;
    this.m2 = 0;
    this.mMax = mMax;
  }

  static fromJSON(json: RollingStatJSON | undefined, fallbackMax = Number.POSITIVE_INFINITY): RollingStat {
    const r = new RollingStat(json?.mMax ?? fallbackMax);
    if (json) {
      r.n = json.n;
      r.mean = json.mean;
      r.m2 = json.m2;
    }
    return r;
  }

  toJSON(): RollingStatJSON {
    return { n: this.n, mean: this.mean, m2: this.m2, mMax: this.mMax };
  }

  push(value: number): void {
    if (!Number.isFinite(value)) return;
    this.n = this.n + 1 > this.mMax ? this.mMax : this.n + 1;
    const delta = value - this.mean;
    this.mean += delta / this.n;
    const delta2 = value - this.mean;
    this.m2 += delta * delta2;
  }

  get count(): number {
    return this.n;
  }

  get variance(): number {
    return this.n < 2 ? 0 : this.m2 / (this.n - 1);
  }

  get stddev(): number {
    return Math.sqrt(this.variance);
  }

  zScore(value: number): number {
    const s = this.stddev;
    return (value - this.mean) / (s || 1);
  }
}
