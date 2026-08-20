# Eskja Segl + Poki v0

Firefox WebExtension pilot for the Segl / poki interaction described in `ESKJA.md`.

The current test path is:

`web page -> Segl -> poki -> keep -> acquisition -> Supabase -> segl-test`

## Current behavior

- Click the extension toolbar button to turn Segl on for the current tab. Firefox shows an `ON` badge and the page shows a small red `SEGL` marker.
- Hover a normal webpage image or select actual webpage text. A deliberately crude red `S` appears.
- Clicking `S` **gathers** the chosen thing into poki. It does not keep it yet.
- Poki persists in `browser.storage.local`, so gathered things survive tab changes.
- Text is stored directly as text plus source-page information.
- Images are stored only as lightweight gathering records: candidate URLs already exposed by the selected image, dimensions, page information, and fallback geometry. Poki does not download or render the image file.
- The poki sidebar contains only a cheap textual representation of each thing, plus remove, clear, and `keep` controls.
- Pressing `keep` resolves each image only then: it tries the best declared candidate first and falls through other candidates if needed. Image-specific visual capture is a last fallback when the original source tab is still available in the required state.
- Kept images are uploaded to the existing `board-images` Supabase bucket and inserted into `board_items` for `segl-test`.
- Kept text is inserted into `board_items` as a movable note/text thing on `segl-test`.
- Successfully kept poki items are removed. Failed items remain in poki.

Segl still never scans, crawls, enumerates, or prefetches the rest of the page.

## Inspect the receiving eskja

Open:

`https://www.eskja.app/board.html?board=segl-test`

## Firefox development install / reload

1. Open `about:debugging#/runtime/this-firefox`.
2. If the old temporary extension is loaded, click **Remove** beside it.
3. Choose **Load Temporary Add-on…**.
4. Select the current `harvest-extension/manifest.json` from the `media-update` checkout/download.
5. Open an ordinary website and click the extension toolbar button so its badge reads `ON`.
6. Hover an image or select text and click the red `S`.
7. Poki should open as a Firefox sidebar and show a lightweight record of the gathered thing.
8. Gather things from additional tabs if desired.
9. Press **keep** in poki.
10. Refresh the `segl-test` board and confirm the kept things arrived.

If Firefox refuses to auto-open poki after a gather, open it manually from Firefox's sidebar menu and choose **poki**. Gathering still persists even when the sidebar is closed.
