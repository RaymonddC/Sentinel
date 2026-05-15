import { entropy as shannon, histogramIntersection } from '../lib/math.js';
import { MS_PER_DAY } from '../lib/time.js';

export interface HistogramJSON {
  buckets: number[];
  edges: number[];   // upper edges; last edge means "and above"
  labels: string[];
  kind: 'posting-time' | 'account-age' | 'comment-length' | 'custom';
}

export class Histogram {
  buckets: number[];
  edges: number[];
  labels: string[];
  kind: HistogramJSON['kind'];

  private constructor(buckets: number[], edges: number[], labels: string[], kind: HistogramJSON['kind']) {
    this.buckets = buckets;
    this.edges = edges;
    this.labels = labels;
    this.kind = kind;
  }

  // ---- Pinned schemas (02-architecture.md § Histogram) ----

  static postingTime24(): Histogram {
    const buckets = new Array<number>(24).fill(0);
    const edges = Array.from({ length: 24 }, (_, i) => i + 1); // hour 0 → edge 1, hour 23 → edge 24
    const labels = Array.from({ length: 24 }, (_, i) => `${i}h`);
    return new Histogram(buckets, edges, labels, 'posting-time');
  }

  static accountAge10(): Histogram {
    const dayEdges = [7, 30, 90, 180, 365, 365 * 2, 365 * 5, 365 * 10, Number.POSITIVE_INFINITY];
    const labels = ['0-7d', '7-30d', '30-90d', '90-180d', '180d-1y', '1-2y', '2-5y', '5-10y', '10y+', 'unknown'];
    const buckets = new Array<number>(10).fill(0);
    return new Histogram(buckets, [...dayEdges.map((d) => d * MS_PER_DAY), Number.POSITIVE_INFINITY], labels, 'account-age');
  }

  static commentLength5(): Histogram {
    const edges = [50, 200, 500, 1500, Number.POSITIVE_INFINITY];
    const labels = ['0-50', '50-200', '200-500', '500-1500', '1500+'];
    const buckets = new Array<number>(5).fill(0);
    return new Histogram(buckets, edges, labels, 'comment-length');
  }

  static fromJSON(json: HistogramJSON | undefined, fallback: () => Histogram): Histogram {
    if (!json) return fallback();
    return new Histogram(json.buckets.slice(), json.edges.slice(), json.labels.slice(), json.kind);
  }

  toJSON(): HistogramJSON {
    return {
      buckets: this.buckets.slice(),
      edges: this.edges.slice(),
      labels: this.labels.slice(),
      kind: this.kind,
    };
  }

  /** Add a value. For posting-time histograms the value is the UTC hour (0-23). */
  add(value: number): void {
    if (this.kind === 'posting-time') {
      const h = Math.floor(value) % 24;
      const idx = h < 0 ? h + 24 : h;
      this.buckets[idx]! += 1;
      return;
    }
    if (this.kind === 'account-age' && (value < 0 || !Number.isFinite(value))) {
      // Unknown bucket lives at index 9 (last).
      this.buckets[9]! += 1;
      return;
    }
    for (let i = 0; i < this.edges.length; i++) {
      if (value < this.edges[i]!) {
        this.buckets[i]! += 1;
        return;
      }
    }
    this.buckets[this.buckets.length - 1]! += 1;
  }

  total(): number {
    let s = 0;
    for (const v of this.buckets) s += v;
    return s;
  }

  normalized(): number[] {
    const t = this.total();
    if (t === 0) return this.buckets.map(() => 0);
    return this.buckets.map((v) => v / t);
  }

  entropy(): number {
    return shannon(this.buckets);
  }

  /** Histogram intersection over normalized buckets, in [0, 1]. */
  overlap(other: Histogram): number {
    return histogramIntersection(this.normalized(), other.normalized());
  }

  /** Percentile of the distribution (p in [0, 100]). Returns midpoint of the bucket edges. */
  percentile(p: number): number {
    const t = this.total();
    if (t === 0) return 0;
    const target = (p / 100) * t;
    let cum = 0;
    for (let i = 0; i < this.buckets.length; i++) {
      cum += this.buckets[i]!;
      if (cum >= target) {
        const lower = i === 0 ? 0 : this.edges[i - 1]!;
        const upper = this.edges[i]!;
        return Number.isFinite(upper) ? (lower + upper) / 2 : lower;
      }
    }
    return 0;
  }

  median(): number {
    return this.percentile(50);
  }
}
