# Jar of Notes — Static (localStorage-only)

This repo is now a pure static app. All data is stored in your browser via `localStorage`.

Files:
- `index.html` — Landing page
- `login.html` — Simple local login (predefined users)
- `notes.html` — Mobile viewer with swipe cards and details overlay
- `setup.html` — Calendar CRUD, stats, quick add, CSV export

Data storage:
- Key: `jarOfMoods.data.v1`
- Shape: `{ entries: { 'YYYY-MM-DD': { mood, title, note, weather?, updatedAt } } }`

How to run locally:
- Just open `index.html` in your browser, or serve the folder with a simple static server.

Optional hosting:
- GitHub Pages (free): Repo Settings → Pages → Deploy from branch → `main` → `/ (root)`.

Reset notes:
- All backend/Vercel/Supabase artifacts were removed.
- If you plan to add a backend later, start a new branch and keep the static app working as the base.
