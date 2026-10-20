# Lè Anton Home

Gallery site for [@le__anton](https://www.instagram.com/le__anton/): handmade soy dessert candles, jesmonite, crochet, macrame and art by Faith Lè Anton.

- **The table:** every piece is a card on an endless canvas. Drag, flick or scroll to move around. Filters dim everything outside the chosen category.
- **The pile:** tap a card and it lifts onto a pile of notes, with the next pieces stacked underneath. Throw the top note away (drag it, swipe it, or press ↓ / →) to reach the next one; ↑ / ← drops the previous one back on. Tap a note under the top one to jump to it.
- **Links to a piece:** `/#<instagram post code>` opens that piece directly, e.g. `/#DOG3YhZDUpx`.

Plain HTML, CSS and JS. No build step.

## Run locally

```sh
python3 -m http.server 8000
# open http://localhost:8000
```
(Opening `index.html` straight from disk won't work, because the page loads `assets/data/pieces.json` with `fetch`.)

## Deploy

Works as-is on Vercel (import the repo, framework preset "Other", no build command), Netlify or GitHub Pages.

## Adding or editing pieces

Everything lives in `assets/data/pieces.json`. Each piece:

| field | what it is |
| --- | --- |
| `code` | Instagram post code; also the image file name |
| `title` | Name shown on the card and the note |
| `cat` | `candles`, `jesmonite`, `fibre`, `art` or `diffusers` |
| `desc` | One or two sentences |
| `scents` | List of scent lines; `" · "` splits a line in two |
| `material` | e.g. `Soy wax`, `Jesmonite`, `Crochet` |
| `date` | `YYYY-MM-DD`; newest is Nº 01 |
| `kind` | `p` for a photo post, `reel` for a video |
| `url` | Link to the Instagram post |
| `w`, `h` | Image size in pixels, used for the card shape |

Add two images for each piece, both JPG named `<code>.jpg`:
- `assets/img/thumb/`, about 520px on the long side
- `assets/img/full/`, about 1200px on the long side

Photos and captions are from the @le__anton Instagram account.

## Photo viewer

Tap the photo on the top note to open it full screen. Scroll, pinch, double-tap or use + / − to zoom, drag to move around. Swipe sideways (or ← →) for the next piece, swipe down or Esc to close.

The viewer loads `assets/img/zoom/<code>.jpg` (the largest size Instagram serves, up to 2400px) and falls back to `assets/img/full/` until it arrives. When adding a piece, put a third, larger copy there.
