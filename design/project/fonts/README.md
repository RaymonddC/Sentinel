# Fonts

Sentinel uses **IBM Plex Sans** (UI/display) and **JetBrains Mono** (usernames, IDs, timestamps).

Both are loaded via Google Fonts CDN in `colors_and_type.css`. If you need offline assets or a self-hosted bundle, drop the `.woff2` files in this folder and replace the `@import` at the top of `colors_and_type.css` with `@font-face` declarations.

## ⚠ Substitution flag

The brief did not specify a typeface. **IBM Plex Sans** + **JetBrains Mono** is my pick because:

- Plex Sans is engineered, neutral, and slightly humanist — the right note for a tool that reports facts.
- Plex's mono companion (IBM Plex Mono) was rejected in favor of **JetBrains Mono**, which has better number legibility at 12–13px — critical for user IDs and timestamps.
- Both are open source (SIL OFL 1.1) and Google Fonts CDN-available.

If you'd like a different pairing (Söhne, Aeonik, Geist, GT America, an internal face, etc.), drop the files in this folder and update the `@import` line.
