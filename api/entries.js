const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;
const ALLOW_ORIGIN = (process.env.ALLOW_ORIGIN || '*').split(',').map(s => s.trim());

const supabase = SUPABASE_URL && SUPABASE_SERVICE_ROLE
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, { auth: { persistSession: false } })
  : null;

function setCors(req, res) {
  const origin = req.headers.origin || '';
  const allowed = ALLOW_ORIGIN.includes('*') || ALLOW_ORIGIN.includes(origin);
  if (allowed) res.setHeader('Access-Control-Allow-Origin', ALLOW_ORIGIN.includes('*') ? '*' : origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

module.exports = async (req, res) => {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!supabase) return res.status(500).json({ error: 'Supabase not configured' });

  try {
    if (req.method === 'GET') {
      const { userId, from, to } = req.query;
      if (!userId) return res.status(400).json({ error: 'userId required' });
      let q = supabase.from('entries').select('*').eq('user_id', userId).order('date_key');
      if (from) q = q.gte('date_key', from);
      if (to) q = q.lte('date_key', to);
      const { data, error } = await q;
      if (error) throw error;
      return res.status(200).json({ entries: data || [] });
    }

    if (req.method === 'PUT') {
      const { userId, date_key, mood, title, note, weather } = req.body;
      if (!userId || !date_key) return res.status(400).json({ error: 'userId and date_key required' });
      const { data, error } = await supabase.from('entries').upsert(
        { user_id: userId, date_key, mood, title, note, weather },
        { onConflict: 'user_id,date_key' }
      ).select().single();
      if (error) throw error;
      return res.status(200).json({ entry: data });
    }

    if (req.method === 'DELETE') {
      const { userId, date } = req.query;
      if (!userId || !date) return res.status(400).json({ error: 'userId and date required' });
      const { error } = await supabase.from('entries').delete().eq('user_id', userId).eq('date_key', date);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};