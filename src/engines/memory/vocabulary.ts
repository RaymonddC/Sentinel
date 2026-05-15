// Bounded vocabulary tracker. Cap at top-N most-frequent; when the underlying
// map exceeds N + overflow, drop the lowest-frequency `overflow` entries.

export class Vocabulary {
  private map: Map<string, number>;
  readonly cap: number;       // target keep size
  readonly overflow: number;  // grow up to cap+overflow before pruning

  constructor(cap = 2000, overflow = 500) {
    this.map = new Map();
    this.cap = cap;
    this.overflow = overflow;
  }

  static fromRecord(rec: Record<string, number>, cap = 2000, overflow = 500): Vocabulary {
    const v = new Vocabulary(cap, overflow);
    for (const [k, c] of Object.entries(rec)) v.map.set(k, c);
    return v;
  }

  toRecord(): Record<string, number> {
    return Object.fromEntries(this.map);
  }

  size(): number {
    return this.map.size;
  }

  get(word: string): number {
    return this.map.get(word) ?? 0;
  }

  add(word: string, n = 1): void {
    this.map.set(word, (this.map.get(word) ?? 0) + n);
    if (this.map.size > this.cap + this.overflow) this.prune();
  }

  /** Drop the `overflow` lowest-frequency entries so we settle back at `cap`. */
  prune(): void {
    const arr = [...this.map.entries()].sort((a, b) => a[1] - b[1]);
    const dropCount = arr.length - this.cap;
    for (let i = 0; i < dropCount; i++) {
      this.map.delete(arr[i]![0]);
    }
  }

  /** Total token count across the entire vocabulary. */
  totalTokens(): number {
    let s = 0;
    for (const v of this.map.values()) s += v;
    return s;
  }

  /** Type-token ratio (vocabulary diversity), in [0,1]. */
  diversity(): number {
    const total = this.totalTokens();
    return total === 0 ? 0 : this.map.size / total;
  }

  keys(): string[] {
    return [...this.map.keys()];
  }
}
