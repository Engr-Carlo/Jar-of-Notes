# Jar of Notes: Frontend on GitHub Pages, Backend on Vercel + Postgres

This repo contains a static frontend (`index.html`, `notes.html`, `setup.html`) and a minimal backend under `api/` suitable for Vercel.

## Architecture
- Frontend: GitHub Pages (from this repo) — serves static files.
- Backend: Vercel Serverless Functions (Node 18) — `api/entries.js`.
- Database: Vercel Postgres.
- CORS: Allow your GitHub Pages origin to call the Vercel API.

## Deploy backend to Vercel
1. Create a new Vercel project from this repo (Import Git Repository in Vercel dashboard).
2. Add Vercel Postgres (Storage > Postgres > Create). Vercel will add env vars like:
   - `POSTGRES_URL`, `POSTGRES_PRISMA_URL`, `POSTGRES_URL_NON_POOLING`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_HOST`, `POSTGRES_DATABASE`
3. In Project Settings > Environment Variables, add `ALLOW_ORIGIN` set to your GitHub Pages URL, e.g. `https://<owner>.github.io/<repo>/`.
4. Deploy. The API endpoint will be like `https://<project-name>.vercel.app/api/entries`.

No separate migration step is required; the function creates the `entries` table on first run.

## Configure GitHub Pages
1. In GitHub repo settings > Pages, select Source: Deploy from a branch. Use `main` and `/ (root)`.
2. After Pages is live, note the site URL and set it in Vercel as `ALLOW_ORIGIN`.

## API contract
- `GET /api/entries` — list all entries
- `GET /api/entries?from=YYYY-MM-DD&to=YYYY-MM-DD` — list entries in date range
- `PUT /api/entries` — upsert one entry
  - Body JSON: `{ date: 'YYYY-MM-DD', mood: 'happy'|'sad'|'angry'|'calm'|'tired'|'neutral', title?: string, note?: string, weather?: { temp?: number, code?: number, desc?: string } }`
  - Returns `{ entry }`
- `DELETE /api/entries?date=YYYY-MM-DD` — delete entry for date

## Frontend wiring (swap from localStorage)
Minimal example calls you can use in `setup.html` / `notes.html`.

```js
const API = 'https://<project-name>.vercel.app/api/entries';

async function listEntries(from, to){
  const url = from && to ? `${API}?from=${from}&to=${to}` : API;
  const res = await fetch(url);
  const data = await res.json();
  // Convert array to map keyed by YYYY-MM-DD for existing code
  const entries = {};
  (data.entries||[]).forEach(e=>{ const k = e.date_key; entries[k] = {
    mood: e.mood, title: e.title, note: e.note,
    weather: e.weather, updatedAt: e.updated_at
  }; });
  return entries;
}

async function saveEntry(date, entry){
  const res = await fetch(API, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date, ...entry })
  });
  if(!res.ok) throw new Error('Save failed');
}

async function deleteEntry(date){
  const res = await fetch(`${API}?date=${date}`, { method: 'DELETE' });
  if(!res.ok) throw new Error('Delete failed');
}
```

### Where to plug in
- In `setup.html`:
  - Replace `loadState()` to call `listEntries()` and build `{entries:{...}}` shape.
  - Replace `saveState()` and `saveEntry()` to call `saveEntry(date, payload)`.
  - Replace delete button to call `deleteEntry(date)`.
- In `notes.html`:
  - Replace `load()` with `listEntries(from,to)` and adapt to map by key.

Tip: Start by reading only the current month range to keep payload small.

## Local testing
You can’t run Vercel functions locally here without the Vercel CLI, but you can deploy and test quickly from the dashboard. If you use the CLI:

- Install Vercel CLI and login.
- Run `vercel dev` to serve `api/` locally (requires Node 18+ and env vars). Use a `.env.local` with Postgres URL and `ALLOW_ORIGIN=http://localhost:3000` if needed.

## Security notes
- Set `ALLOW_ORIGIN` to your exact Pages URL in production (don’t leave `*`).
- The API is intentionally simple and unauthenticated; if you plan to expose it, consider adding an auth token and validating it in the handler.
