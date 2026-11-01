# WVideos IP-Based Redirect

## Project structure

```text
wvideos/
├── app/
│   ├── api/
│   │   └── redirect/
│   │       └── route.js
│   ├── layout.js
│   └── page.js
├── package.json
└── README.md
```

## Environment variables

Add these in Vercel → Project → Settings → Environment Variables:

- `LINK_1`: First destination URL (must be http:// or https://)
- `LINK_2`: Second destination URL (must be http:// or https://)
- `UPSTASH_REDIS_REST_URL`: Upstash Redis REST URL
- `UPSTASH_REDIS_REST_TOKEN`: Upstash Redis REST token

`Redis.fromEnv()` reads the two `UPSTASH_REDIS_REST_*` variables.

## Deploy

1. Upload/commit this project structure to your GitHub repository.
2. Import the repository into Vercel (or connect the existing Vercel project).
3. Add all four environment variables.
4. Redeploy after setting the variables.
5. Visit `https://YOUR-DOMAIN/api/redirect` to test.

## Behavior

- First GET request from a public IP within the 12-hour Redis window → `LINK_1`.
- Subsequent GET requests from that same public IP → `LINK_2`.
- After the Redis key expires (12 hours after first successful set), the next GET → `LINK_1`.
- HEAD requests inspect the current destination but do not create the Redis key.

## Important limitations

This identifies public IP addresses, not individual people or devices. Devices behind the same Wi-Fi/router usually share one public IP and therefore share the same 12-hour visitor record. Mobile carrier NAT, VPNs, proxies, and changing IP addresses can cause different users to share an IP or one user to appear as a new visitor.

The route uses Vercel's `x-real-ip` request header. If that header is unavailable in a deployment environment, the route returns HTTP 503 rather than guessing an IP.
