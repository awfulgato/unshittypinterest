# UNShitty Pinterest — Supabase version

This is the browser-hosted version. It does NOT need Python, PowerShell, Docker, or a local server.

## Files
- `index.html` — landing page
- `nav.html` / `nav.js` — husbond / wyf character pages
- `board.html` / `app.js` — shared boards
- `styles.css` — visual styling
- `supabase-config.js` — your Supabase URL + publishable key
- `setup.sql` — database + private storage setup

## One-time Supabase setup
1. Open Supabase SQL Editor.
2. Paste all of `setup.sql`.
3. Run it.
4. In Authentication -> Users, create the two users who should access the site.
5. In `supabase-config.js`, paste your Project URL and Publishable/anon key from Project Settings -> API.

Do NOT put a Supabase service-role/secret key in this project. Only the publishable/anon key belongs in browser code.

## Hosting
Upload these website files to GitHub, then import that repository into Vercel. Vercel serves the static files; Supabase stores the board data and image files.

## Image persistence
Uploaded originals are stored in the private `board-images` Supabase Storage bucket. Board rows are stored in `board_items`. The website never automatically deletes an image. An image is deleted from storage only when the user explicitly deletes that image from its board.

### Important
The app uses Supabase anonymous sign-in so you do not have to manage a login screen. In Supabase Dashboard, open Authentication -> Sign In / Providers and enable **Anonymous sign-ins**.
