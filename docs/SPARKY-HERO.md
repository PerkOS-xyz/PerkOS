# Sparky in the landing hero

The hero art is no longer a still nebula: it is a short clip of Sparky, the
PerkOS mascot, turning to face the viewer. The clip never plays on a clock —
its timeline is scrubbed by scroll position, so he turns exactly as fast as you
scroll and turns back if you scroll up.

Files: `app/components/landing/v2/SparkyVideo.tsx`,
`app/components/landing/v2/HeroV2.tsx`,
`app/components/landing/v2/LandingContentV2.tsx`.

## Two takes, not one

The nebula background is baked into the clip, so framing cannot be fixed with
CSS — a 16:9 take on a phone is scaled to fill the height and crops away most of
the width. There are two takes, chosen by viewport:

| | Desktop (`md+`) | Phones |
|---|---|---|
| Asset | `public/hero/sparky-hero.mp4` | `public/hero/sparky-hero-mobile.mp4` |
| Frame | 16:9, 1440px | 9:16, 720px |
| Sparky | right side, beside the copy | centred, alone on stage |
| Weight | ~2.0 MB | ~1.7 MB |

`SparkyVideo` waits for mount before choosing, so a phone does not download the
desktop take and then the portrait one on the same visit. Before mount it
renders a `<picture>` whose `<source media>` lets the browser pick the matching
poster without JavaScript — handing the portrait poster to a wide viewport makes
`object-cover` blow it up, and Sparky flashes in enormous on every reload.

## Scroll choreography

**Desktop** — copy and Sparky share the stage. The turn is mapped to the first
320px of scroll, deliberately short: the cover block starts swallowing the hero
almost immediately, so a longer travel would spend the turn off-screen.

**Phones** — the copy and a legible Sparky do not fit in one screen, so the
pinned hero plays two beats over an extra screen of scroll (the `h-screen
md:hidden` spacer in `LandingContentV2`):

| Scroll | |
|---|---|
| 0 → 20% | Copy alone over a near-solid veil |
| 20% → 38% | The veil lifts, the scene appears, the copy leaves |
| 34% → 106% | Sparky alone, turning as you scroll |

The beats overlap on purpose so the screen is never empty mid-handoff.

The copy does not fade as a block there. `HeroExit` gives each line its own
start, distance and easing (`progress^1.7`), so later lines begin later and
travel further and the copy peels away in cascade. On `md+` `HeroExit` is inert
and the shared block transform still owns the copy — desktop behaviour is
unchanged.

## Things that will bite

**The clip must be encoded all-intra.** Every frame is a keyframe
(`-g 1 -keyint_min 1 -sc_threshold 0`). A normally-encoded mp4 has to rebuild
from the previous keyframe on every seek and the scrub visibly stutters. This
costs weight — the desktop take is 2.0 MB instead of 0.3 MB — and it is not
optional.

**Never stack seeks.** Assigning `currentTime` while `video.seeking` is true
makes the decoder drop the request and the scrub feels stuck. The loop skips the
assignment while a seek is in flight and eases the playhead so a flicked scroll
does not snap through the turn.

**The art-layer parallax is desktop-only.** `nebY` drifts the layer down as the
cover block rises. On phones the hero stays pinned for an extra screen, so that
drift runs to its limit and pushes the video past the wrapper's 6% margin,
leaving a gap above Sparky. On phones the layer holds its place and only scales
slightly instead.

**`prefers-reduced-motion` gets the poster**, not the video.

## Debugging

Append `?sparkydebug=1` to the landing URL for an on-screen readout of
`scrollY`, the mapped progress, the playhead, and the video's `paused`,
`seeking` and `readyState`. If progress climbs while the playhead does not, the
problem is the seek; if `scrollY` never moves, the problem is the scroller.

## Regenerating the clips

The takes are generated, not hand-animated, and the sources live outside this
repo. What matters here:

- Both takes start from a **composited first frame** (nebula + Sparky) and are
  pinned to a **composited last frame**, which is what keeps him from sliding
  across the frame or changing size mid-clip.
- Framing is fixed in the asset, never with CSS. Leave headroom: at a 2.2:1
  viewport `object-cover` eats about 10% of the height top and bottom, and a
  take that fills the frame vertically loses the flame.
- Keep the eyes as two vertical rounded bars. Asking for expressive eye shapes
  makes the model repaint the visor white.
