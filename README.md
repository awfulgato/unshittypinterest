# UNShitty Pinterest — complete browser-hosted version

## Upload ALL of these files to the GitHub repository

- index.html
- nav.html
- nav.js
- board.html
- app.js
- styles.css
- supabase-config.js
- setup.sql
- wyf.html
- key.png

No Python, PowerShell, Docker, or local server is required.

## Supabase

1. Run `setup.sql` once in Supabase SQL Editor.
2. In Supabase Authentication -> Providers, enable Anonymous Sign-Ins.
3. In `supabase-config.js`, paste your Supabase Project URL and Publishable/anon key.
4. Never use a service-role/secret key in this website.

## Image safety / persistence

Uploaded originals are stored as files in the private `board-images` Supabase Storage bucket. Board records store the permanent storage path. The website generates temporary viewing URLs when a board opens; those URLs can expire, but the underlying original file remains in Storage.

The website does not automatically move, overwrite, resize, filter, age, or delete the original stored file. Moving/resizing/filtering/aging only changes the board item's display state. The original is removed from Storage only when the user explicitly presses the delete control.

## WYF gate

`wyf.html` uses the supplied `key.png` exactly as an image, scaled only for display. Clicking it reveals a blank password box. The password is `caeg`; pressing Enter opens the WYF navigation page.

## Hosting

Push/commit all files to GitHub and let Vercel deploy the repository. Vercel only hosts the static website. Supabase handles the shared board database and image storage.
