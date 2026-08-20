# Eskja Segl v0

Firefox WebExtension pilot for the Segl interaction described in `ESKJA.md`.

This pilot deliberately skips poki. A successful Segl action is immediately kept into the dedicated test eskja `segl-test` so the full path can be tested now:

`web page -> Segl -> acquisition -> Supabase -> Eskja`

## Current behavior

- Click the extension toolbar button to turn Segl on for the current tab. Firefox shows an `ON` badge and the page shows a small red `SEGL` marker.
- Hover a normal webpage image. A deliberately crude red `S` appears on the image.
- Click `S` to gather that exact image.
- Segl records only candidate sources exposed by that image (`currentSrc`, `src`, `srcset`, matching `<picture>` sources, common lazy/full-size data attributes, and direct image links). It does not scan or enumerate the page.
- At this v0 stage, click also means immediate keep: Segl tries the largest/best declared candidate first, falls through the remaining candidates only if needed, then uses image-specific visual capture only if resource retrieval fails.
- The resulting image is uploaded to the existing `board-images` Supabase bucket and a `board_items` row is inserted for board `segl-test`.
- Select actual webpage text. The same red `S` appears beside the selection. Click it and the selected string is inserted immediately into `segl-test` as a movable text/note item. The source page URL is retained in the row's `src` field.
- A green check means the thing reached Supabase. A red dashed `x` means it did not.
- Click the toolbar button again to turn Segl off for that tab.

## Inspect the receiving eskja

Open:

`https://www.eskja.app/board.html?board=segl-test`

If the current deployment is a branch preview instead of the production domain, use the same `/board.html?board=segl-test` path on that preview URL.

## Firefox development install

1. Open `about:debugging#/runtime/this-firefox`.
2. Choose **Load Temporary Add-on…**.
3. Select `harvest-extension/manifest.json`.
4. Open an ordinary website and click the extension toolbar button so its badge reads `ON`.
5. Hover an image or select text and click the red `S`.
6. Open the `segl-test` board URL above and confirm the thing arrived.

The old sidebar files remain in the directory for reference but are not used by Segl v0. Poki comes later.
