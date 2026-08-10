# UNShitty Pinterest

Static Vercel site + Supabase database/storage.

## Before deploying
Open `supabase-config.js` and replace the two placeholders with:
- Supabase Project URL
- Supabase Publishable (anon) key

The browser needs the publishable/anon key. Do NOT put a Supabase service-role key in this file.

## Supabase once
1. Supabase -> SQL Editor -> run `setup.sql`.
2. Supabase -> Authentication -> Providers -> Anonymous Sign-Ins: enable it.

## Vercel
Upload/commit every file in this folder, including `key.png`. Redeploy after changes.

## Navigation
Home -> husbond or wyf.
Wyf -> exact supplied key image -> password box -> `caeg` -> WYF navigation.
Direct access to `nav.html?nav=wyf` is also gated by the session unlock.
