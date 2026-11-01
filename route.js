import { Redis } from '@upstash/redis';

export const runtime = 'edge';

const redis = Redis.fromEnv();
const DURATION = 12 * 60 * 60; // 12 hours

const LINK1 = process.env.LINK_1;
const LINK2 = process.env.LINK_2;

function validUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

function getVisitorIP(request) {
  // Vercel supplies this header for the incoming client connection.
  const ip = request.headers.get('x-real-ip');
  return ip ? ip.trim() : null;
}

async function hashIP(ip) {
  const data = new TextEncoder().encode(ip);
  const hash = await crypto.subtle.digest('SHA-256', data);

  return Array.from(new Uint8Array(hash))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}

function redirectResponse(destination) {
  return new Response(null, {
    status: 302,
    headers: {
      Location: destination,
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    },
  });
}

function validConfig() {
  return validUrl(LINK1) && validUrl(LINK2);
}

// HEAD requests check the destination but do not create/consume a visit.
export async function HEAD(request) {
  if (!validConfig()) {
    return new Response(null, { status: 500 });
  }

  const ip = getVisitorIP(request);
  if (!ip) {
    return new Response(null, { status: 503 });
  }

  try {
    const key = `saim:ip:${await hashIP(ip)}`;
    const exists = await redis.exists(key);
    return redirectResponse(exists ? LINK2 : LINK1);
  } catch (error) {
    console.error('Redis HEAD Error:', error);
    return redirectResponse(LINK2);
  }
}

export async function GET(request) {
  if (!validConfig()) {
    return new Response('Invalid redirect configuration', { status: 500 });
  }

  const ip = getVisitorIP(request);
  if (!ip) {
    return new Response('Unable to identify visitor IP', { status: 503 });
  }

  try {
    const key = `saim:ip:${await hashIP(ip)}`;
    const result = await redis.set(key, '1', {
      nx: true,
      ex: DURATION,
    });

    return redirectResponse(result === 'OK' ? LINK1 : LINK2);
  } catch (error) {
    console.error('Redis GET Error:', error);
    return redirectResponse(LINK2);
  }
}
