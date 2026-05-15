# Third-party licenses

Sentinel bundles the following third-party data. Source code is MIT (see `package.json`).

## AFINN-2015-en sentiment lexicon

- File: `src/data/afinn-2015-en.json`
- Author: Finn Årup Nielsen, Technical University of Denmark
- License: Open Database License (ODbL) v1.0 — https://opendatacommons.org/licenses/odbl/1.0/
- Upstream: https://github.com/fnielsen/afinn
- Citation: Nielsen, F. Å., "A new ANEW: evaluation of a word list for sentiment analysis in microblogs", 2011.

The lexicon is used unmodified for English-language token scoring in the Health Score engine. Per ODbL, derivative works that share the database must remain under the same license; Sentinel does not redistribute a modified database — it loads the data at runtime for sentiment scoring only.

## Emoji sentiment extension

- File: `src/data/emoji-sentiment.json`
- Author: Sentinel project (curated for hackathon)
- License: MIT (same as Sentinel)

30-entry table covering common Reddit emoji; see `sentinel-spec/05-engine-health-score.md` for the source table.
