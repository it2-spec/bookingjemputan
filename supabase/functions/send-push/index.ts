// ============================================================
// Supabase Edge Function: send-push
// Uses industry-standard web-push npm library for 100% RFC 8291 compliant encryption
// Deploy with: supabase functions deploy send-push
// ============================================================

import { createClient } from 'jsr:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY') || '';
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') || '';
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@example.com';

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

interface PushSubscriptionRow {
  id: string;
  employee_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

Deno.serve(async (req) => {
  // Handle CORS
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

  const {
    title,
    message,
    targetEndpoint,
    targetEmployeeId,
    targetRole,
    url = '/',
    unbookedOnly = true,
    targetDate,
  } = await req.json();
  if (!title || !message) {
    return new Response(JSON.stringify({ error: 'title and message are required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  // If targeting a role (e.g. 'vendor'), also broadcast via Realtime channel
  if (targetRole === 'vendor') {
    try {
      const vChannel = supabase.channel('vendor-notifications');
      await vChannel.send({
        type: 'broadcast',
        event: 'new-notification',
        payload: { title, message, url: url || '/vendor', timestamp: Date.now() },
      });
    } catch (vErr) {
      console.warn('[Vendor Channel Broadcast] Error:', vErr);
    }
  }

  // Fetch push subscriptions
  let query = supabase.from('push_subscriptions').select('*');
  if (targetEndpoint) {
    query = query.eq('endpoint', targetEndpoint);
  } else if (targetEmployeeId) {
    query = query.eq('employee_id', targetEmployeeId);
  } else if (targetRole) {
    const { data: roleEmps } = await supabase
      .from('employees')
      .select('id')
      .eq('role', targetRole);
    const roleEmpIds = (roleEmps || []).map((e: any) => e.id);
    query = query.in('employee_id', roleEmpIds);
  }

  const { data: rawSubscriptions, error } = await query;

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  let subscriptions = (rawSubscriptions || []) as PushSubscriptionRow[];

  // Filter out employees who have ALREADY booked for tomorrow (if broadcast reminder)
  if (unbookedOnly && !targetEndpoint && !targetEmployeeId && !targetRole) {
    let departureDate = targetDate;
    if (!departureDate) {
      // Calculate tomorrow's date in WIB (UTC+7)
      const nowWIB = new Date(Date.now() + 7 * 3600000);
      const tomorrow = new Date(nowWIB.getTime() + 24 * 3600000);
      departureDate = tomorrow.toISOString().split('T')[0];
    }

    const { data: bookedRows } = await supabase
      .from('bookings')
      .select('employee_id')
      .eq('departure_date', departureDate)
      .eq('status', 'confirmed');

    const bookedEmployeeIds = new Set((bookedRows || []).map((b: any) => b.employee_id));

    subscriptions = subscriptions.filter((sub) => {
      if (sub.employee_id && bookedEmployeeIds.has(sub.employee_id)) {
        return false; // Skip because user already booked
      }
      return true;
    });
  }

  const payload = JSON.stringify({
    title,
    body: message,
    icon: '/tracer.png',
    badge: '/tracer.png',
    image: '/tracer.png',
    url: targetRole === 'vendor' ? '/vendor' : (url || '/'),
    tag: 'shuttle-' + Date.now(),
    timestamp: Date.now(),
  });

  const results = await Promise.allSettled(
    (subscriptions as PushSubscriptionRow[]).map(async (sub) => {
      // If native device token without full WebPush encryption keys
      if (sub.endpoint.startsWith('native:')) {
        try {
          // Broadcast to Supabase Realtime channel so APK receives notification instantly
          const channel = supabase.channel(`user-notifications-${sub.employee_id}`);
          await channel.send({
            type: 'broadcast',
            event: 'new-notification',
            payload: { title, message, url: '/' },
          });
        } catch (bErr) {
          console.warn('[Realtime Broadcast] Error:', bErr);
        }
        return { ok: true, isNative: true };
      }

      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth,
        },
      };

      return await webpush.sendNotification(pushSubscription, payload, {
        TTL: 86400,
        urgency: 'high',
        headers: {
          'Urgency': 'high',
        },
      });
    }),
  );

  const errorDetails: string[] = [];
  const staleEndpoints: string[] = [];

  let sent = 0;
  results.forEach((r, i) => {
    const sub = (subscriptions as PushSubscriptionRow[])[i];
    if (r.status === 'fulfilled') {
      sent++;
    } else {
      const err = r.reason;
      const statusCode = err?.statusCode;
      const errMsg = err?.body || err?.message || String(err);
      errorDetails.push(`Status ${statusCode || 'ERR'}: ${errMsg}`);

      // If token is gone or expired (404 / 410)
      if (statusCode === 404 || statusCode === 410) {
        staleEndpoints.push(sub.endpoint);
      }
    }
  });

  const failed = results.length - sent;

  // Clean up stale endpoints from DB
  if (staleEndpoints.length > 0) {
    await supabase.from('push_subscriptions').delete().in('endpoint', staleEndpoints);
  }

  return new Response(
    JSON.stringify({
      success: true,
      sent,
      failed,
      total: subscriptions.length,
      errors: errorDetails.slice(0, 5),
    }),
    {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    },
  );
});
