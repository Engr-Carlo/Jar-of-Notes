const webpush = require('web-push');
const { createClient } = require('@supabase/supabase-js');

function getClient(){
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, key);
}

function setVapid(){
  const subject = process.env.VAPID_SUBJECT || 'mailto:admin@example.com';
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if(!pub || !priv) throw new Error('Missing VAPID keys');
  webpush.setVapidDetails(subject, pub, priv);
}

async function getPartners(supabase, actorUserId){
  // Assuming 'matches' table with user_a, user_b, status='accepted'
  // Fetch both directions
  const { data: rows1, error: e1 } = await supabase
    .from('matches')
    .select('user_a,user_b,status')
    .or(`user_a.eq.${actorUserId},user_b.eq.${actorUserId}`)
    .eq('status','accepted');
  if(e1) throw e1;
  const partners = new Set();
  for(const r of rows1 || []){
    if(r.user_a === actorUserId && r.user_b) partners.add(r.user_b);
    else if(r.user_b === actorUserId && r.user_a) partners.add(r.user_a);
  }
  return Array.from(partners);
}

async function getSubscriptions(supabase, userIds){
  if(userIds.length === 0) return [];
  const { data, error } = await supabase
    .from('push_subscriptions')
    .select('id,user_id,endpoint,p256dh,auth')
    .in('user_id', userIds);
  if(error) throw error;
  return data || [];
}

async function sendToAll(subs, payload){
  const results = [];
  for(const s of subs){
    const sub = { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } };
    try{
      await webpush.sendNotification(sub, JSON.stringify(payload));
      results.push({ endpoint: s.endpoint, ok: true });
    }catch(err){
      const status = err.statusCode || err.status || 0;
      results.push({ endpoint: s.endpoint, ok: false, status });
    }
  }
  return results;
}

async function cleanupExpired(supabase, results){
  const expired = results.filter(r => !r.ok && (r.status === 404 || r.status === 410)).map(r => r.endpoint);
  if(expired.length){
    await supabase.from('push_subscriptions').delete().in('endpoint', expired);
  }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try{
    const { actorUserId, date_key, title, mood, note } = req.body || {};
    if(!actorUserId || !date_key){
      return res.status(400).json({ error: 'Missing actorUserId or date_key' });
    }
    setVapid();
    const supabase = getClient();
    const partnerIds = await getPartners(supabase, actorUserId);
    const subs = await getSubscriptions(supabase, partnerIds);

    const shortBody = title ? title : (mood ? `Mood: ${mood}` : 'Open to read');
    const payload = {
      title: `New journal from ${actorUserId}`,
      body: shortBody,
      url: `/notes.html?date=${encodeURIComponent(date_key)}`
    };

    const results = await sendToAll(subs, payload);
    await cleanupExpired(supabase, results);
    return res.status(200).json({ ok: true, sent: results.length });
  }catch(err){
    console.error(err);
    return res.status(500).json({ error: 'Notify failed' });
  }
};
