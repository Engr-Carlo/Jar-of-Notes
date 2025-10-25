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
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

module.exports = async (req, res) => {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!supabase) return res.status(500).json({ error: 'Supabase not configured' });

  try {
    const { action, username, password } = req.body;

    // LOGIN
    if (action === 'login') {
      if (!username || !password) {
        return res.status(400).json({ error: 'Username and password required' });
      }

      const { data: user, error } = await supabase
        .from('users')
        .select('username, password_hash')
        .eq('username', username)
        .single();

      if (error || !user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Simple password check (in production, use bcrypt)
      if (user.password_hash !== password) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      return res.status(200).json({ 
        success: true, 
        username: user.username 
      });
    }

    // REGISTER
    if (action === 'register') {
      if (!username || !password) {
        return res.status(400).json({ error: 'Username and password required' });
      }

      if (username.length < 3) {
        return res.status(400).json({ error: 'Username must be at least 3 characters' });
      }

      if (password.length < 4) {
        return res.status(400).json({ error: 'Password must be at least 4 characters' });
      }

      // Check if username already exists
      const { data: existing } = await supabase
        .from('users')
        .select('username')
        .eq('username', username)
        .single();

      if (existing) {
        return res.status(409).json({ error: 'Username already exists' });
      }

      // Insert new user (in production, hash the password with bcrypt)
      const { data: newUser, error } = await supabase
        .from('users')
        .insert({ username, password_hash: password })
        .select('username')
        .single();

      if (error) {
        return res.status(500).json({ error: 'Failed to create user' });
      }

      return res.status(201).json({ 
        success: true, 
        username: newUser.username 
      });
    }

    return res.status(400).json({ error: 'Invalid action. Use "login" or "register"' });
  } catch (err) {
    console.error('Auth error:', err);
    return res.status(500).json({ error: err.message });
  }
};
