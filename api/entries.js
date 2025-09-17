import { sql } from '@vercel/postgres';

// Simple CORS for GitHub Pages frontend
const ALLOW_ORIGIN = process.env.ALLOW_ORIGIN || '*'; // set to your Pages URL in prod

async function ensureSchema() {
  await sql`CREATE TABLE IF NOT EXISTS entries (
    id SERIAL PRIMARY KEY,
    date_key DATE NOT NULL UNIQUE,
    mood TEXT NOT NULL,
    title TEXT,
    note TEXT,
    weather JSONB,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );`;
}

function send(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', ALLOW_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'GET,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.end(JSON.stringify(data));
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', ALLOW_ORIGIN);
    res.setHeader('Access-Control-Allow-Methods', 'GET,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.statusCode = 204; res.end(); return;
  }

  try {
    await ensureSchema();
  } catch (e) {
    return send(res, 500, { error: 'schema_init_failed', detail: String(e) });
  }

  try {
    if (req.method === 'GET') {
      const { from, to } = req.query;
      if (from && to) {
        const { rows } = await sql`SELECT * FROM entries WHERE date_key BETWEEN ${from} AND ${to} ORDER BY date_key`;
        return send(res, 200, { entries: rows });
      } else {
        const { rows } = await sql`SELECT * FROM entries ORDER BY date_key`;
        return send(res, 200, { entries: rows });
      }
    }

    if (req.method === 'PUT') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const { date, mood, title = '', note = '', weather = null } = body || {};
      if (!date || !mood) return send(res, 400, { error: 'missing_fields', need: ['date','mood'] });

      const { rows } = await sql`
        INSERT INTO entries (date_key, mood, title, note, weather, updated_at)
        VALUES (${date}, ${mood}, ${title}, ${note}, ${weather}, NOW())
        ON CONFLICT (date_key)
        DO UPDATE SET mood = EXCLUDED.mood, title = EXCLUDED.title, note = EXCLUDED.note, weather = EXCLUDED.weather, updated_at = NOW()
        RETURNING *;
      `;
      return send(res, 200, { entry: rows[0] });
    }

    if (req.method === 'DELETE') {
      const { date } = req.query;
      if (!date) return send(res, 400, { error: 'missing_date' });
      await sql`DELETE FROM entries WHERE date_key = ${date}`;
      return send(res, 200, { ok: true });
    }

    return send(res, 405, { error: 'method_not_allowed' });
  } catch (e) {
    return send(res, 500, { error: 'server_error', detail: String(e) });
  }
}
