const { createClient } = require('@supabase/supabase-js');

const ALLOW_ORIGIN = process.env.ALLOW_ORIGIN || '*';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;

const supabase = SUPABASE_URL && SUPABASE_SERVICE_ROLE
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, { auth: { persistSession: false } })
  : null;

function pickAllowedOrigin(req) {
  const cfg = (ALLOW_ORIGIN || '*').split(',').map(s => s.trim()).filter(Boolean);
  if (cfg.includes('*')) return '*';
  const origin = req.headers.origin || '';
  const match = cfg.find(o => o === origin);
  return match || cfg[0] || '*';
}

function cors(req, res) {
  const origin = pickAllowedOrigin(req);
  res.setHeader('Access-Control-Allow-Origin', origin);
  if (origin !== '*') res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

module.exports = async function handler(req, res) {
  cors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (!supabase) {
    return res.status(500).json({ error: 'Supabase not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE.' });
  }

  try {
    if (req.method === 'GET') {
      const { userId, from, to } = req.query || {};
      if (!userId) return res.status(400).json({ error: 'userId is required' });
      let q = supabase.from('entries').select('*').eq('user_id', userId).order('date_key');
      if (from) q = q.gte('date_key', from);
      if (to) q = q.lte('date_key', to);
      const { data, error } = await q;
      if (error) throw error;
      return res.status(200).json({ entries: data });
    }

    if (req.method === 'PUT') {
      const { userId, date_key, mood, title, note, weather } = req.body || {};
      if (!userId || !date_key) return res.status(400).json({ error: 'userId and date_key required' });
      const payload = { user_id: userId, date_key, mood, title, note, weather };
      const { data, error } = await supabase
        .from('entries')
        .upsert(payload, { onConflict: 'user_id,date_key' })
        .select()
        .single();
      if (error) throw error;
      return res.status(200).json({ entry: data });
    }

    if (req.method === 'DELETE') {
      const { userId, date } = req.query || {};
      if (!userId || !date) return res.status(400).json({ error: 'userId and date required' });
      const { error } = await supabase.from('entries').delete().eq('user_id', userId).eq('date_key', date);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: String(err?.message || err) });
  }
};