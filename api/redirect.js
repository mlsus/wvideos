
import { Redis } from '@upstash/redis';

export const config = {
  runtime: 'edge',
};

const redis = Redis.fromEnv();

const DURATION = 12 * 60 * 60; // 12 hours

const LINK1 = process.env.LINK_1;
const LINK2 = process.env.LINK_2;

// Validate redirect URLs
function validUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

// Get visitor IP from Vercel request headers
function getVisitorIP(req) {
  const forwarded = req.headers.get('x-forwarded-for');

  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  const realIP = req.headers.get('x-real-ip');

  if (realIP) {
    return realIP.trim();
  }

  return null;
}

// Hash IP address using SHA-256
async function hashIP(ip) {
  const data = new TextEncoder().encode(ip);
  const hash = await crypto.subtle.digest('SHA-256', data);

  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export default async function handler(req) {

  // Allow GET and HEAD only
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return new Response('Method Not Allowed', {
      status: 405,
      headers: { Allow: 'GET, HEAD' },
    });
  }

  // Validate redirect URLs
  if (!validUrl(LINK1) || !validUrl(LINK2)) {
    return new Response('Invalid redirect configuration', {
      status: 500,
    });
  }

  // Get visitor IP
  const ip = getVisitorIP(req);

  if (!ip) {
    return new Response('Unable to identify visitor IP', {
      status: 503,
    });
  }

  const headers = new Headers({
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
  });

  let destination;

  try {
    // Create a private IP hash
    const ipHash = await hashIP(ip);

    const redisKey = `saim:ip:${ipHash}`;

    if (req.method === 'HEAD') {
      // HEAD requests do not consume the first visit
      const existing = await redis.exists(redisKey);

      destination = existing ? LINK2 : LINK1;

    } else {
      // Atomic IP-based visitor tracking
      const result = await redis.set(
        redisKey,
        '1',
        {
          nx: true,
          ex: DURATION,
        }
      );

      // First IP visit = LINK1
      // Existing IP = LINK2
      destination = result === 'OK' ? LINK1 : LINK2;
    }

  } catch (error) {
    console.error('Redis Redirect Error:', error);

    // Redis failure fallback
    destination = LINK2;
  }

  headers.set('Location', destination);

  return new Response(null, {
    status: 302,
    headers,
  });
}
