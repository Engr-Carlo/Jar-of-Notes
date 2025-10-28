const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  return res.status(200).json({ publicKey: VAPID_PUBLIC_KEY });
}
