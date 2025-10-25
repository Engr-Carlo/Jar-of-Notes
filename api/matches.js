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
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

module.exports = async (req, res) => {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!supabase) return res.status(500).json({ error: 'Supabase not configured' });

  try {
    const { action, username, targetUsername, requestId } = req.method === 'GET' ? req.query : req.body;

    // GET: List all users (for browsing)
    if (req.method === 'GET' && action === 'list_users') {
      const { data: users, error } = await supabase
        .from('users')
        .select('username, created_at')
        .order('username');
      
      if (error) throw error;
      return res.status(200).json({ users });
    }

    // GET: Get match requests for a user (sent + received)
    if (req.method === 'GET' && action === 'get_requests') {
      if (!username) return res.status(400).json({ error: 'username required' });

      const { data: sent, error: sentError } = await supabase
        .from('match_requests')
        .select('*')
        .eq('sender_username', username);

      const { data: received, error: receivedError } = await supabase
        .from('match_requests')
        .select('*')
        .eq('receiver_username', username);

      if (sentError || receivedError) throw sentError || receivedError;

      return res.status(200).json({ sent: sent || [], received: received || [] });
    }

    // GET: Get all matches for a user
    if (req.method === 'GET' && action === 'get_matches') {
      if (!username) return res.status(400).json({ error: 'username required' });

      const { data: matches, error } = await supabase
        .from('matches')
        .select('*')
        .or(`user1.eq.${username},user2.eq.${username}`);

      if (error) throw error;

      // Extract partner usernames
      const partners = matches.map(m => m.user1 === username ? m.user2 : m.user1);

      return res.status(200).json({ matches: partners });
    }

    // POST: Send match request
    if (req.method === 'POST' && action === 'send_request') {
      if (!username || !targetUsername) {
        return res.status(400).json({ error: 'username and targetUsername required' });
      }

      if (username === targetUsername) {
        return res.status(400).json({ error: 'Cannot send request to yourself' });
      }

      // Check if request already exists
      const { data: existing } = await supabase
        .from('match_requests')
        .select('*')
        .or(`and(sender_username.eq.${username},receiver_username.eq.${targetUsername}),and(sender_username.eq.${targetUsername},receiver_username.eq.${username})`)
        .single();

      if (existing) {
        return res.status(409).json({ error: 'Request already exists' });
      }

      // Check if already matched
      const { data: match } = await supabase
        .from('matches')
        .select('*')
        .or(`and(user1.eq.${username < targetUsername ? username : targetUsername},user2.eq.${username < targetUsername ? targetUsername : username})`)
        .single();

      if (match) {
        return res.status(409).json({ error: 'Already matched' });
      }

      const { data: request, error } = await supabase
        .from('match_requests')
        .insert({ sender_username: username, receiver_username: targetUsername })
        .select()
        .single();

      if (error) throw error;

      return res.status(201).json({ request });
    }

    // PUT: Accept or reject match request
    if (req.method === 'PUT' && action === 'respond_request') {
      if (!requestId || !username) {
        return res.status(400).json({ error: 'requestId and username required' });
      }

      const { status } = req.body;
      if (!status || !['accepted', 'rejected'].includes(status)) {
        return res.status(400).json({ error: 'status must be accepted or rejected' });
      }

      // Verify user is the receiver
      const { data: request, error: fetchError } = await supabase
        .from('match_requests')
        .select('*')
        .eq('id', requestId)
        .eq('receiver_username', username)
        .single();

      if (fetchError || !request) {
        return res.status(404).json({ error: 'Request not found or unauthorized' });
      }

      const { data: updated, error } = await supabase
        .from('match_requests')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', requestId)
        .select()
        .single();

      if (error) throw error;

      return res.status(200).json({ request: updated });
    }

    // DELETE: Remove match
    if (req.method === 'DELETE' && action === 'remove_match') {
      if (!username || !targetUsername) {
        return res.status(400).json({ error: 'username and targetUsername required' });
      }

      const user1 = username < targetUsername ? username : targetUsername;
      const user2 = username < targetUsername ? targetUsername : username;

      const { error } = await supabase
        .from('matches')
        .delete()
        .eq('user1', user1)
        .eq('user2', user2);

      if (error) throw error;

      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: 'Invalid action' });
  } catch (err) {
    console.error('Matches error:', err);
    return res.status(500).json({ error: err.message });
  }
};
