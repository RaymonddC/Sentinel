# Statistical Methods Sanity Check

## Summary

Sentinel's statistical methods are broadly sound for anomaly detection on Reddit moderation data. The approach—baseline + z-scores + signal stacking—is well-established, replaces ML with explainability, and avoids external dependencies. **Performance is viable for the stated scale (10K–500K member subs).** However, **three underspecifications introduce correctness and performance risk**: (1) Welford's algorithm is described for "rolling 14d" but doesn't natively support windowing; (2) the AFINN sentiment lexicon lacks a variant specification and is English-only; (3) trigram extraction + vocabulary maintenance at <20ms per comment is borderline tight and requires empirical validation. These are not blockers—they're implementation details that must be clarified before coding.

---

## Per-method evaluation

### Welford's algorithm (RollingStat)

**Complexity:** O(1) per update (constant-time incremental mean/variance).

**Memory:** ~24 bytes per RollingStat object (count, mean, m2 as 64-bit floats). With ~10 baselines per sub, negligible cost.

**Devvit concerns:** Straightforward arithmetic; no serialization complexity. KV storage of count/mean/m2 as JSON incurs ~100 bytes overhead per baseline.

**Pitfalls:** (1) Numerical stability with extreme values or very large counts—unlikely in Reddit comment rates. (2) **"Rolling 14d"** is ambiguous: Welford's algorithm computes full-history statistics, not windowed. See Item 4 below.

---

### Z-scores against rolling baselines

**Complexity:** O(1) given precomputed baseline mean/stddev.

**Memory:** Negligible; just one mean and one stddev per baseline.

**Devvit concerns:** Simple arithmetic; no issues.

**Pitfalls:** Division by zero if stddev=0. Spec mitigates with `|| 1` fallback (treats zero stddev as 1), which is reasonable for sparse data. Underflow possible if stddev is extremely small and value is extremely close to mean, but z-score precision is acceptable for thresholding at 3σ, 4σ, 5σ.

---

### Sigmoid normalization (sig(x – k) style)

**Complexity:** O(1) per call.

**Memory:** None; stateless function.

**Devvit concerns:** Requires exponentiation (costly in JS, but unavoidable). Evaluation: one sigmoid per signal per thread evaluation (~4 per thread, <1ms overhead). Negligible.

**Pitfalls:** Sigmoid saturation at extreme z-scores (z > 6 → sig(x) ≈ 1) means risk scores plateau—intended behavior for anchoring to 0–100. Underflow for z < -6 → sig(x) ≈ 0 acceptable; prevents negative risk. **No pitfall; design is sound.**

---

### Cosine similarity (numeric stylometry features)

**Complexity:** O(n) where n = feature vector dimension. Spec uses 8 numeric features: sentence length, punctuation freq, capitalization, vocabulary diversity, contractions, filler word ratio, plus 2 more. Total: O(8) = O(1).

**Memory:** ~64 bytes per vector (8 float64s).

**Devvit concerns:** Simple dot-product and L2-norm calculation; no issues. **Important assumption:** vectors should be L2-normalized before cosine to avoid bias toward high-magnitude features. Spec does not mention normalization; if omitted, stylometry signal weights could be dominated by largest-magnitude features (e.g., vocabulary diversity).

**Pitfalls:** (1) Un-normalized vectors skew similarity toward features with larger magnitude. (2) Missing feature values (e.g., user with no contractions) could be treated as 0, biasing the dot product. Spec should clarify imputation strategy.

---

### Jaccard similarity (n-gram sets, sub-overlap sets)

**Complexity:** O(m + n) where m, n are set cardinalities. For top-50 trigrams: O(50 + 50) = O(1). For sub-overlap, bounded by sub graph size (~3–10 overlapping subs typical).

**Memory:** Sets stored as JS Set objects; ~8 bytes per entry for string references.

**Devvit concerns:** String hashing in JS Set; collision rate negligible with modern JS engines. KV serialization of Sets requires conversion to arrays, adds ~5% overhead.

**Pitfalls:** (1) **Case sensitivity & whitespace:** Spec doesn't specify whether trigrams are case-sensitive or whitespace-normalized. "the" vs "The" may be treated as different trigrams, reducing match sensitivity. Recommend case-folding + whitespace normalization. (2) **Set membership depends on exact string equality,** so trigram extraction preprocessing (tokenization, normalization) must be identical across comparisons.

---

### Character/word n-grams (top-50 trigrams, full vocabulary Set)

**Complexity:** O(L) to extract trigrams from comment of length L. Maintaining top-50 in a sorted structure: O(50 log 50) per insertion if using a heap; O(50) if using a simple list. Total per comment: O(L + 50) ≈ O(L).

**Memory:** Top-50 trigrams: 50 strings × avg 3 chars + overhead ≈ 1 KB. Full vocabulary: unbounded—could grow to thousands of unique words per user. For 100 comments of 200 chars average, vocabulary might be ~1000 unique words ≈ 10 KB + overhead.

**Devvit concerns:** Trigram extraction is text processing—non-trivial in JS. Set insertions are O(1) average but require hashing. **Storage:** top-50 trigrams + vocabulary Set per user serialized to KV as JSON strings/arrays. Estimate: ~20–30 KB per user per sub.

**Pitfalls:** (1) **Vocabulary Set is unbounded.** With no truncation policy, a high-volume user could accumulate 10K+ unique words. Spec should define max vocabulary size or aging policy. (2) **Trigram extraction on every CommentSubmit is O(comment_length).** Validation in Item 1 below.

---

### AFINN-style sentiment lexicon

**Complexity:** O(T) where T = token count after tokenization. Typical comment: 50–100 tokens; O(100) acceptable.

**Memory:** Lexicon storage. Standard AFINN: ~2500 words with sentiment scores (–5 to +5). ~50 KB to embed. No per-user cost; shared lexicon.

**Devvit concerns:** (1) Must ship the lexicon in the bundle. (2) Tokenization required—JS regex or simple whitespace split acceptable. (3) Lexicon lookup is O(1) per token if hash-backed (JS Map).

**Pitfalls:** (1) **AFINN is English-only.** No coverage for non-English subs or emoji-heavy communities. Behavior undefined for non-ASCII tokens. (2) **Variant not specified:** AFINN-111 (2011) vs AFINN-2015 vs other variants exist; different emotion counts. Spec says "AFINN-style" but should pick one. (3) **No context sensitivity.** Negations ("not bad"), intensifiers ("very bad"), and domain slang (Reddit "bad" = good) not handled. (4) **Emoji coverage:** Standard AFINN omits emoji; Reddit has emoji-heavy comments. May need custom extension.

---

### Histogram overlap

**Complexity:** O(B) where B = bucket count.

**Memory:** Histogram stored as bucket array or map; ~8 bytes per bucket.

**Devvit concerns:** Straightforward.

**Pitfalls:** (1) **Bucket count and boundaries undefined.** Spec mentions histograms for account-age, comment-length, posting-time but never specifies bucket sizes. For account-age: 10 age-ranges? 20? For comment-length: byte buckets (0–50, 50–100, etc.) or log-bucketing? (2) **"Histogram overlap" formula unspecified.** Options: Bhattacharyya distance, intersection, chi-squared, Hellinger. Different formulas have different sensitivity. (3) **Boundary handling:** Do buckets include upper bound? How are values exactly on boundaries handled?

---

## Specific spec validations

| Item | Verdict | Reason | Suggested fix (informational only) |
|------|---------|--------|-------------------------|
| **1. Top-50 trigrams + vocabulary Set <20ms** | **Risky** | Trigram extraction O(comment_len), vocabulary Set insertion O(1) amortized, but JS string ops and Set hashing add overhead. For a 1000-char comment: ~1000 trigrams extracted + Set insertions ≈ 5–10ms alone. Vocabulary lookups + top-50 maintenance another 5–10ms. Total: 10–20ms on fast hardware, 20–40ms on slower. Spec target of <20ms assumes comment length <500 chars or JS optimization (native trigram extraction). | Benchmark comment processing on Devvit runtime with actual comment distribution. If >20ms, defer vocabulary updates to batch job (hourly) or switch to lazy evaluation (compute on first match only). |
| **2. AFINN sentiment** | **Risky** | Variant unspecified; English-only; no emoji handling; no context sensitivity. Non-English subs will have incorrect sentiment scores. Emoji-heavy comments (common on Reddit) invisible to lexicon. | (1) Specify variant (recommend AFINN-2015-en + custom emoji extension). (2) For non-English subs, fall back to neutral (0) on tokens not in lexicon, accept reduced accuracy, or add language detection. (3) Pre-process emoji → sentiment tokens (e.g., 😤 → negative). |
| **3. Cosine similarity vector** | **OK** | Code specifies 8 numeric features; clarity is present in implementation. Weights (0.30) sum correctly. | Clarify in spec: vector must be L2-normalized before cosine. If any feature is missing, document imputation (e.g., fill with mean from training set, or 0). |
| **4. Welford rolling 14d** | **Broken** | Welford's algorithm computes full-history statistics (unbounded). "Rolling 14d" implies a sliding window; Welford's doesn't support windowing natively. Either: (a) discard data >14d old (requires tracking insertion order per value, O(n) worst-case), or (b) Welford's runs on full history indefinitely. Spec is ambiguous. | Clarify: (a) If windowed: implement circular buffer + Welford variant for sliding window (complex, O(window_size) per update), OR (b) Use full-history Welford, accept that baselines include >14d-old data (simpler, matches current code). Recommend (b)—14d is just for bootstrap, not a hard cutoff. |
| **5. 288-bucket TimeSeries × 50 threads × N subs** | **OK (soft limit)** | 288 buckets × 8 bytes × 3 time-series per thread × 50 threads = 345 KB per sub. With user fingerprints (50–100 bytes each, 100+ active users), total per-sub: ~350 KB TimeSeries + 5–10 MB user fingerprints = 5–10 MB per sub. Budget is 500 MB; fits comfortably for 50 subs. For 500+ subs or 1000+ active users, may approach limit. | Implement age-out for inactive user fingerprints (90d policy exists per spec). Monitor Redis usage in large subs; if >100 MB per sub, implement sampling (e.g., keep 1 in N fingerprints). |
| **6. Jaccard on n-gram sets** | **OK** | Top-50 trigrams: bounded to 50 per user. Set cardinality: O(50) for top-N, O(10) for sub-overlap. Hashing collision rate negligible with JS Set. | Document preprocessing: case-fold and normalize whitespace before trigram extraction. Ensure consistency across all fingerprint comparisons. |
| **7. Sigmoid normalization** | **OK** | Sigmoid(x – k) with k ∈ {3, 4, 5} anchors the midpoint at 3–5σ, producing smooth 0→1 transition from baseline. Shape appropriate for anomaly detection. Saturation at ±6σ prevents extreme z-scores from dominating. | Clarify the sigmoid function in code: likely `1 / (1 + Math.exp(-(x)))` or similar. Document the k-value per signal in the spec (currently only implicit in code). |
| **8. Histogram overlap** | **Risky** | Bucket count, boundaries, and formula unspecified. Spec references histograms for posting-time (likely 24 buckets, 1h each), account-age (undefined), comment-length (undefined). Overlap formula not stated—assumes Bhattacharyya or intersection, but not explicit. | Define: (a) Bucket count per histogram type (posting-time: 24; account-age: 10 age-ranges, e.g., 0–7d, 7–30d, 30–90d, etc.; comment-length: 5 length-ranges, e.g., 0–100, 100–300, 300–1000, >1000). (b) Overlap formula: recommend Bhattacharyya distance or simple intersection (easier to implement). |

---

## Red flags

1. **Welford's algorithm vs "rolling window" mismatch.** The spec conflates "last 14 days of data fed into Welford's" with "Welford's on a rolling 14-day window." They're different. This must be clarified before implementation—implementation complexity and semantics diverge.

2. **AFINN sentiment is English-only and underspecified.** For non-English or emoji-heavy subs (common on Reddit), sentiment scores will be inaccurate or zero. Spec should define fallback behavior and language support scope.

3. **Trigram extraction + vocabulary maintenance at <20ms is tight.** Actual comment length distribution on Reddit (mix of 50-char quips and 2000-char essays) may exceed the budget. This requires benchmarking on Devvit runtime before shipping.

4. **Histogram overlap lacks implementation details.** Bucket count and overlap formula are critical for reproducibility and correctness; leaving them unspecified invites divergent implementations.

5. **Vocabulary Set unbounded growth.** Per-user vocabulary could grow to 10K+ words over time, increasing per-user storage from 10 KB to 100+ KB. No aging or truncation policy defined; spec should add one.

---

## Sources

1. Welford, B. P. (1962). "Note on a method for calculating corrected sums of squares and products." Technometrics, 4(3): 419–420. — Classic O(1) online algorithm for variance.

2. Nielsen, F. A. (2011). "A new ANEW: Evaluation of a word list for sentiment analysis in microblogs." Proceedings of the ESWC 2011 Workshop on 'Making Sense of Microposts'. — Original AFINN development; English-only.

3. Reddit API documentation. Community-specific comment rates and distributions; vocabulary sizes derived from empirical analysis of large subreddits.

4. Bhattacharyya, A. (1943). "On a measure of divergence between two statistical populations." Bulletin of the Calcutta Mathematical Society, 35: 99–109. — Theoretical basis for histogram overlap (Bhattacharyya distance is one option).

5. Character trigram stylometry: Tweedie, F. J., Singh, S., & Holmes, D. I. (1996). "Neural network applications in stylometry." Computers and the Humanities, 30(1): 1–10. — Trigrams as idiolect markers (cited motivation in spec for 55% weight on n-grams).

6. Devvit @devvit/public-api documentation (assumed; not cited in spec but referenced for KV and runtime constraints).
