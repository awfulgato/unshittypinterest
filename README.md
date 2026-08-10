# UNShitty Pinterest

Static Vercel site + Supabase database/storage.

## Supabase (one-time)
1. Open Supabase -> SQL Editor.
2. Paste the entire `setup.sql`.
3. Run it.

The script is safe to run again. It does not delete board rows or stored images.

## Deploy
Upload/commit **all files in this folder** to the existing GitHub repository. Do not delete the repository.

Required files: `index.html`, `nav.html`, `nav.js`, `board.html`, `app.js`, `styles.css`, `wyf.html`, `key.png`, `supabase-config.js`, `setup.sql`, `vercel.json`.

The supplied key PNG is embedded directly into `wyf.html`, so the WYF key does not depend on an external image path. `key.png` is also retained in the project.

## Behavior
- `+` opens the image picker and immediately uploads selected images to Supabase Storage.
- `&` creates a text note.
- Boards persist in Supabase.
- WYF shows the exact supplied key image. Clicking it reveals only the password box. `caeg` unlocks WYF.
