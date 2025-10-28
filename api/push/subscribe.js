const { createClient } = require('@supabase/supabase-js');

function getClient(){
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, key);
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try{
    const { userId, subscription } = req.body || {};
    if(!userId || !subscription || !subscription.endpoint || !subscription.keys){
      return res.status(400).json({ error: 'Invalid payload' });
    }
    const { endpoint, keys } = subscription;
    const p256dh = keys.p256dh;
    const auth = keys.auth;

    const supabase = getClient();
    // upsert by endpoint
    const { data, error } = await supabase
      .from('push_subscriptions')
      .upsert({ user_id: userId, endpoint, p256dh, auth, last_used_at: new Date().toISOString() }, { onConflict: 'endpoint' })
      .select('id');
    if(error) throw error;
    return res.status(200).json({ ok: true });
  }catch(err){
    console.error(err);
    return res.status(500).json({ error: 'Subscribe failed' });
  }
};
