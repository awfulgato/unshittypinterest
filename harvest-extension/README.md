# Eskja Segl + Poki v0

Firefox WebExtension pilot for the Segl / poki interaction described in `ESKJA.md`.

The current test path is:

`web page -> Segl -> poki -> keep -> acquisition -> Supabase -> segl-test`

## Interaction model

- The Eskja toolbar button opens one compact popup. There is no persistent Firefox sidebar.
- Segl is global rather than tab-specific. Turn it on once and it remains active while moving through ordinary tabs until turned off.
- While Segl is on, hover a normal webpage image or select actual webpage text. The deliberately crude red `S` appears.
- Clicking `S` gathers the chosen thing silently into poki. Browsing layout does not move and poki does not auto-open.
- The toolbar badge shows the number of things currently carried in poki.
- Click the Eskja toolbar button whenever you want to inspect poki, remove something, clear it, toggle Segl, or press `keep`.

## Poki behavior

- Poki persists in `browser.storage.local`, so gathered things survive tab changes.
- Text is stored directly as text plus source-page information.
- Images are stored only as lightweight gathering records: candidate URLs already exposed by the selected image, dimensions, page information, and fallback geometry. Poki does not download or render the full image file while gathering.
- Pressing `keep` resolves each image only then: it tries the best declared candidate first and falls through other candidates if needed. Image-specific visual capture remains a last fallback when the original source tab is still available in the required state.
- Kept images are uploaded to the existing `board-images` Supabase bucket and inserted into `board_items` for `segl-test`.
- Kept text is inserted into `board_items` as a movable note/text thing on `segl-test`.
- Successfully kept poki items are removed. Failed items remain in poki.

Segl still never scans, crawls, enumerates, or prefetches the rest of the page.

## Inspect the receiving eskja

Open:

`https://www.eskja.app/board.html?board=segl-test`

## Firefox development install / reload

1. Open `about:debugging#/runtime/this-firefox`.
2. Remove the old temporary Eskja extension.
3. Choose **Load Temporary Add-on…**.
4. Select the current `harvest-extension/manifest.json` from the `media-update` download.
5. Click the Eskja toolbar button. In the popup, turn **segl on**.
6. Close the popup and browse normally across tabs.
7. Hover an image or select text and click the red `S`. The toolbar badge count should rise without opening any sidebar.
8. Click the Eskja toolbar button to inspect poki.
9. Press **keep**.
10. Refresh `segl-test` and confirm the kept things arrived.
