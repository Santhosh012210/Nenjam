# Nenjam — நெஞ்சம்
### A private, end-to-end encrypted PWA for exactly two people.

---

## What you need before starting

- A computer with [Node.js](https://nodejs.org/) (v18 or later) installed
- A free [Supabase](https://supabase.com) account
- A free [Cloudflare](https://cloudflare.com) account (for R2 storage)
- A free [Vercel](https://vercel.com) or [Netlify](https://netlify.com) account (to host the app)

> **No Mapbox account needed.** The map uses Leaflet + OpenStreetMap/CARTO tiles — completely free, no sign-up, no token.

---

## Step 1 — Set up Supabase

1. Go to https://supabase.com and create a new project. Name it "nenjam".
2. Wait for the project to finish setting up (takes ~1 minute).
3. In the left sidebar, click **SQL Editor**.
4. Click **New Query**, paste the entire contents of `supabase/schema.sql`, and click **Run**.
5. You should see "Success. No rows returned." — that means it worked.
6. Go to **Authentication → Providers → Email** and make sure **Enable Email provider** is ON.
7. Go to **Authentication → Settings** and turn **OFF** "Enable sign ups". This prevents anyone from registering. You will create the two accounts manually.
8. Click **Project Settings → API** and copy:
   - **Project URL** (looks like `https://abcdefgh.supabase.co`)
   - **anon public** key (the long string under "Project API keys")

---

## Step 2 — Manually create the two user accounts

> Do this BEFORE the user limit trigger fires. Since the trigger only stops 3+ users, the first two accounts are fine.

1. In Supabase, go to **Authentication → Users**.
2. Click **Add user → Create new user**.
3. Enter your email and a strong password. Click **Create User**.
4. Repeat for your partner's email.
5. Now go to **Table Editor → profiles**.
6. You will see two rows (auto-created). Click on each row and set the `display_name` field (e.g., "Sandy" and "Priya").
7. **Link the partners:** Copy User A's `id` (the UUID). In User B's row, set `partner_id` to User A's `id`. Then in User A's row, set `partner_id` to User B's `id`. Click Save on each.

---

## Step 3 — Set up Cloudflare R2

1. Log in to Cloudflare, go to **R2 Object Storage**.
2. Click **Create bucket**, name it `nenjam-photos`.
3. Go to **R2 → Manage R2 API tokens**, click **Create API Token**.
4. Choose "Object Read and Write" for the `nenjam-photos` bucket. Click **Create**.
5. Note down:
   - **Account ID** (shown at top of R2 page)
   - **Access Key ID**
   - **Secret Access Key**
6. To make photos publicly accessible: in the bucket settings, under **Public access**, enable the public URL. Copy the `r2.dev` public URL shown.

---

## Step 4 — Configure the app

1. In the `nenjam` folder, copy `.env.example` to a new file called `.env`:
   ```
   cp .env.example .env
   ```
2. Open `.env` and fill in each value:
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   VITE_R2_ACCOUNT_ID=your-cloudflare-account-id
   VITE_R2_ACCESS_KEY_ID=your-r2-access-key-id
   VITE_R2_SECRET_ACCESS_KEY=your-r2-secret-key
   VITE_R2_BUCKET_NAME=nenjam-photos
   VITE_R2_PUBLIC_URL=https://pub-xxxx.r2.dev
   VITE_RELATIONSHIP_START=2023-01-01   ← Change to your actual anniversary date
   ```
   > The map works out of the box — no map API key needed.

---

## Step 5 — Install and run locally (to test)

Open a terminal in the `nenjam` folder and run:
```bash
npm install
npm run dev
```

Open http://localhost:5173 in your browser. You should see the Nenjam login screen.

---

## Step 6 — First login and PIN setup

1. Enter your email and password (the ones you created in Supabase).
2. After logging in, you will be asked to create a PIN. This PIN protects your encryption keys on your device.
3. Choose a 4–6 digit PIN you will remember. Your partner will set their own PIN on their device.
4. Your encryption keys are now generated and locked behind your PIN.
5. **Important:** the first time both of you log in, each person's public key is uploaded to Supabase. The shared encryption key (used for chat, notes, photos) is only computed once BOTH of you have logged in at least once.

---

## Step 7 — Deploy to Vercel (so it's accessible on your iPhones)

1. Push the `nenjam` folder to a **private** GitHub repository.
2. Go to https://vercel.com, log in with GitHub, and import the repository.
3. Under **Environment Variables**, add all the variables from your `.env` file.
4. Click **Deploy**.
5. Vercel will give you a URL like `https://nenjam-xxx.vercel.app`.

> **Important:** The app needs two special HTTP headers for the video montage (ffmpeg.wasm) to work. Add these to your Vercel project:
> Go to Vercel → Project Settings → Headers → Add:
> - `Cross-Origin-Opener-Policy: same-origin`
> - `Cross-Origin-Embedder-Policy: require-corp`

---

## Step 8 — Install on iPhone (Add to Home Screen)

1. Open Safari on your iPhone.
2. Navigate to your Vercel URL.
3. Tap the **Share** button (the box with an arrow pointing up).
4. Scroll down and tap **"Add to Home Screen"**.
5. Tap **Add** in the top right.
6. Nenjam is now installed as an app on your iPhone! Open it from the home screen.

---

## How to add Tamil songs to the playlist

1. Log in to the app.
2. Go to **More → Our Song & Tamil Playlist**.
3. The default songs (Vaseegara, Munbe Vaa, etc.) are pre-loaded.
4. To add a song: paste the YouTube URL of any Tamil song and give it a title. Tap **Add to playlist**.
5. To set one as "Our Song" (plays softly on the home screen): tap the pink Play button next to any song.

---

## How the encryption works (plain English)

- When you first log in, the app generates a **keypair** — like a lock and a key. Your public key (the lock) goes to Supabase so your partner can use it. Your private key (the actual key) never leaves your device.
- Your private key is encrypted with your PIN using a strong algorithm (PBKDF2 + AES-GCM). Only your PIN can unlock it.
- For **chat and shared features**: both of your keys are combined mathematically (Diffie-Hellman) to create a shared secret. This is the same key on both devices — so both of you can encrypt and decrypt. The server only ever stores scrambled text.
- For your **private journal**: a different key is used, derived from your own private key. Only you can read it.
- For **photos**: each photo is encrypted before upload to Cloudflare R2. The R2 bucket only ever contains scrambled binary data.

---

## Troubleshooting

**"Waiting for partner's public key" in chat:**
Your partner has not logged in yet. Both of you need to log in and set up a PIN at least once for the shared key to work.

**Photos not appearing on the map:**
The photo you uploaded must have GPS data in its EXIF metadata. Most iPhone camera photos have this. Screenshots and downloaded images do not.

**Video montage not working:**
The montage feature requires photos from the same month in previous years. Also, it requires the COOP/COEP headers to be set (see Step 8).

**"Maximum of 2 users" error:**
This means someone tried to create a third account. The database trigger is working correctly. 

---

## Folder structure

```
nenjam/
├── src/
│   ├── components/      — All UI components
│   │   ├── chat/        — Chat bubbles and input
│   │   ├── home/        — Home screen widgets
│   │   ├── layout/      — Bottom nav and layout wrapper
│   │   ├── montage/     — "Last year" video player
│   │   ├── more/        — Journal, KeyDates, Notes, etc.
│   │   └── ui/          — Shared Modal component
│   ├── lib/             — Utilities (Supabase, encryption, R2, EXIF, image)
│   ├── pages/           — Top-level route pages
│   ├── stores/          — Zustand state (auth, encryption, app)
│   ├── styles/          — Global CSS + Tailwind
│   └── types/           — TypeScript types
├── supabase/
│   └── schema.sql       — Run this in Supabase SQL editor
├── public/
│   └── icons/           — PWA icons (see below)
└── .env.example         — Copy to .env and fill in
```

---

## PWA Icons (required for iPhone)

You need icon PNG files at `public/icons/icon-192.png` and `public/icons/icon-512.png`.

Quick way: Go to https://realfavicongenerator.net, upload any image (a heart, the Tamil letter ந, etc.), and download the generated icons. Place them in `public/icons/`.

---

## Security checklist

- [x] No sign-up — login only
- [x] Supabase `enable_signup` disabled (set in Auth settings)
- [x] DB trigger rejects > 2 users
- [x] All messages/notes/photos E2E encrypted with tweetnacl
- [x] Private keys never leave device
- [x] PIN-protected key storage (PBKDF2 + AES-GCM)
- [x] RLS policies on every table
- [x] No analytics, no third-party tracking scripts
- [x] No third-party map account — OpenStreetMap tiles are fetched directly, no tracking
