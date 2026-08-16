# Eskja Harvest

Firefox WebExtension prototype for the browser gathering tool described in `ESKJA.md`.

## Current behavior

- Hover a normal webpage `<img>` to reveal the Eskja sickle.
- Click the sickle to gather the image into the temporary browser bag.
- Eskja first retrieves the image resource directly. If that fails, it captures only the visible bounds of the recognized image element.
- A broken sickle appears only when both acquisition paths fail.
- The sidebar bag is intentionally not an Eskja canvas: no moving, resizing, nesting, saturation, or other board controls.
- `keep` sends the gathered images into the existing Eskja Supabase storage/table path.
- `husbond / wyf` is a temporary compatibility choice while the current application still has those two boards instead of storeskja delivery.

## Firefox development install

1. Open `about:debugging#/runtime/this-firefox`.
2. Choose **Load Temporary Add-on…**.
3. Select `harvest-extension/manifest.json`.
4. Click the Eskja toolbar button to open the bag.

This source directory is intended to be packaged/signed once the gathering behavior is stable.
