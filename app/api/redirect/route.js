
import { Redis } from '@upstash/redis';

export const runtime = 'edge';

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

// Get visitor public IP from Vercel headers
function getVisitorIP(request) {
  const realIP = request.headers.get('x-real-ip');

  if (realIP) {
    return realIP.trim();
  }

  const forwarded = request.headers.get('x-forwarded-for');

  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  return null;
}

// Hash IP using SHA-256
async function hashIP(ip) {
  const data = new TextEncoder().encode(ip);
  const hash = await crypto.subtle.digest('SHA-256', data);

  return Array.from(new Uint8Array(hash))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}

// Common response headers
function createHeaders(destination) {
  return new Headers({
    'Location': destination,
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
  });
}

// Validate configuration
function checkConfig() {
  return validUrl(LINK1) && validUrl(LINK2);
}

// HEAD: Check destination without consuming first visit
export async function HEAD(request) {
  if (!checkConfig()) {
    return new Response(null, { status: 500 });
  }

  const ip = getVisitorIP(request);

  if (!ip) {
    return new Response(null, { status: 503 });
  }

  try {
    const ipHash = await hashIP(ip);
    const key = `saim:ip:${ipHash}`;

    const exists = await redis.exists(key);

    const destination = exists ? LINK2 : LINK1;

    return new Response(null, {
      status: 302,
      headers: createHeaders(destination),
    });

  } catch (error) {
    console.error('Redis HEAD Error:', error);

    return new Response(null, {
      status: 302,
      headers: createHeaders(LINK2),
    });
  }
}

// GET: Main redirect logic
export async function GET(request) {
  if (!checkConfig()) {
    return new Response('Invalid redirect configuration', {
      status: 500,
    });
  }

  const ip = getVisitorIP(request);

  if (!ip) {
    return new Response('Unable to identify visitor IP', {
      status: 503,
    });
  }

  try {
    const ipHash = await hashIP(ip);
    const key = `saim:ip:${ipHash}`;

    // Atomic Redis operation
    const result = await redis.set(
      key,
      '1',
      {
        nx: true,
        ex: DURATION,
      }
    );

    const destination = result === 'OK' ? LINK1 : LINK2;

    return new Response(null, {
      status: 302,
      headers: createHeaders(destination),
    });

  } catch (error) {
    console.error('Redis GET Error:', error);

    return new Response(null, {
      status: 302,
      headers: createHeaders(LINK2),
    });
  }
}
