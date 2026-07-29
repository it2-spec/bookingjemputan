// ============================================================
// Supabase Edge Function: send-push
// Sends Web Push notifications to all subscribed users
// Deploy with: supabase functions deploy send-push
// ============================================================

import { createClient } from 'jsr:@supabase/supabase-js@2';

// Web Push using VAPID via built-in crypto in Deno
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY') || '';
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') || '';
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@example.com';

interface PushSubscription {
  id: string;
  employee_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

// Convert base64url to Uint8Array
function base64urlToUint8Array(base64url: string): Uint8Array {
  const padding = '='.repeat((4 - (base64url.length % 4)) % 4);
  const base64 = (base64url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// Convert Uint8Array to base64url
function uint8ArrayToBase64url(bytes: Uint8Array): string {
  const binary = String.fromCharCode(...bytes);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// Generate VAPID JWT for Authorization header
async function generateVapidJWT(audience: string): Promise<string> {
  const header = { alg: 'ES256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud: audience,
    exp: now + 12 * 3600, // 12 hours
    sub: VAPID_SUBJECT,
  };

  const encode = (obj: object) =>
    uint8ArrayToBase64url(new TextEncoder().encode(JSON.stringify(obj)));

  const signingInput = `${encode(header)}.${encode(payload)}`;

  const privateKeyBytes = base64urlToUint8Array(VAPID_PRIVATE_KEY);
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    privateKeyBytes,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    cryptoKey,
    new TextEncoder().encode(signingInput),
  );

  const signatureBytes = new Uint8Array(signature);
  return `${signingInput}.${uint8ArrayToBase64url(signatureBytes)}`;
}

// Send a single Web Push notification
async function sendWebPush(
  subscription: PushSubscription,
  title: string,
  message: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const url = new URL(subscription.endpoint);
    const audience = `${url.protocol}//${url.host}`;

    const jwt = await generateVapidJWT(audience);

    // Build payload
    const payloadData = JSON.stringify({ title, body: message });
    const payloadBytes = new TextEncoder().encode(payloadData);

    // Derive shared secret using ECDH with user's p256dh key
    const serverKeyPair = await crypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      ['deriveKey', 'deriveBits'],
    );

    // Import the user's public key (p256dh)
    const userPublicKeyBytes = base64urlToUint8Array(subscription.p256dh);
    const userPublicKey = await crypto.subtle.importKey(
      'raw',
      userPublicKeyBytes,
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      [],
    );

    // Derive shared bits
    const sharedBits = await crypto.subtle.deriveBits(
      { name: 'ECDH', public: userPublicKey },
      serverKeyPair.privateKey,
      256,
    );

    // Export server public key for header
    const serverPublicKeyRaw = await crypto.subtle.exportKey('raw', serverKeyPair.publicKey);
    const serverPublicKeyBytes = new Uint8Array(serverPublicKeyRaw);

    // Auth secret
    const authBytes = base64urlToUint8Array(subscription.auth);

    // HKDF to derive content encryption key and nonce
    const prk = await crypto.subtle.importKey('raw', new Uint8Array(sharedBits), 'HKDF', false, ['deriveKey', 'deriveBits']);

    // Use simple AES-GCM encryption with derived key
    const salt = crypto.getRandomValues(new Uint8Array(16));

    const inputKeyMaterial = await crypto.subtle.importKey(
      'raw',
      new Uint8Array(sharedBits),
      { name: 'HKDF' },
      false,
      ['deriveBits'],
    );

    const keyBits = await crypto.subtle.deriveBits(
      {
        name: 'HKDF',
        hash: 'SHA-256',
        salt: authBytes,
        info: new TextEncoder().encode('Content-Encoding: aesgcm\0'),
      },
      inputKeyMaterial,
      128,
    );

    const encryptionKey = await crypto.subtle.importKey('raw', keyBits, 'AES-GCM', false, ['encrypt']);

    const nonceBits = await crypto.subtle.deriveBits(
      {
        name: 'HKDF',
        hash: 'SHA-256',
        salt: authBytes,
        info: new TextEncoder().encode('Content-Encoding: nonce\0'),
      },
      prk,
      96,
    );
    const nonce = new Uint8Array(nonceBits);

    const paddedPayload = new Uint8Array(payloadBytes.length + 2);
    paddedPayload.set([0, 0]); // no padding
    paddedPayload.set(payloadBytes, 2);

    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, encryptionKey, paddedPayload);

    const response = await fetch(subscription.endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `vapid t=${jwt}, k=${VAPID_PUBLIC_KEY}`,
        'Content-Type': 'application/octet-stream',
        'Content-Encoding': 'aesgcm',
        'Encryption': `salt=${uint8ArrayToBase64url(salt)}`,
        'Crypto-Key': `dh=${uint8ArrayToBase64url(serverPublicKeyBytes)};p256ecdsa=${VAPID_PUBLIC_KEY}`,
        'TTL': '86400',
      },
      body: encrypted,
    });

    if (response.status === 201 || response.status === 200 || response.status === 204) {
      return { ok: true };
    }
    const errorText = await response.text();
    return { ok: false, error: `HTTP ${response.status}: ${errorText}` };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

Deno.serve(async (req) => {
  // CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'authorization, content-type',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  const { title, message } = await req.json();
  if (!title || !message) {
    return new Response(JSON.stringify({ error: 'title and message are required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  // Fetch all push subscriptions
  const { data: subscriptions, error } = await supabase
    .from('push_subscriptions')
    .select('*');

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  const results = await Promise.allSettled(
    (subscriptions as PushSubscription[]).map((sub) => sendWebPush(sub, title, message)),
  );

  const sent = results.filter((r) => r.status === 'fulfilled' && r.value.ok).length;
  const failed = results.length - sent;

  // Remove invalid subscriptions (410 Gone)
  const staleEndpoints: string[] = [];
  results.forEach((r, i) => {
    if (r.status === 'fulfilled' && !r.value.ok && r.value.error?.includes('HTTP 410')) {
      staleEndpoints.push((subscriptions as PushSubscription[])[i].endpoint);
    }
  });
  if (staleEndpoints.length > 0) {
    await supabase.from('push_subscriptions').delete().in('endpoint', staleEndpoints);
  }

  return new Response(
    JSON.stringify({ success: true, sent, failed, total: subscriptions.length }),
    {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    },
  );
});
