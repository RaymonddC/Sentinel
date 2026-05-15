# Icons

Sentinel uses **[Lucide](https://lucide.dev)** for all glyphs, loaded via CDN.

```html
<script src="https://unpkg.com/lucide@latest/dist/umd/lucide.min.js"></script>
<script>lucide.createIcons();</script>
```

In React/JSX, render an icon as:
```jsx
<i data-lucide="radar" width="16" height="16"></i>
```
…then call `lucide.createIcons()` after mount.

## Rules
- **1.5px stroke weight**, no filled variants
- Sizes: **14, 16, 20, 24** (16px default)
- Color follows `currentColor`
- Icon-only buttons must have an adjacent text label (no hover tooltips in Devvit mobile)

## Sentinel → Lucide mapping
| Concept | Lucide |
|---|---|
| Raid Radar | `radar` |
| Memory | `history` |
| Health Score | `activity` |
| Audit log | `scroll-text` |
| Cluster | `git-fork` |
| User | `user` |
| Critical alert | `alert-octagon` |
| High alert | `alert-triangle` |
| Medium alert | `alert-circle` |
| Healthy | `check-circle-2` |
| Archive | `archive` |
| Modmail | `inbox` |
| Filter | `filter` |
| More | `more-horizontal` |
| Time / span | `clock` |

## ⚠ Substitution flag
The brief did not specify an icon system. Lucide is my pick. If you'd prefer Phosphor / Heroicons / Reddit's internal set, swap the CDN and update the mapping table.
