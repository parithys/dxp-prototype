# Hosting the VFQ DXP review build

The app is a Next.js application (App Router): Next owns every URL, so it needs a Node host rather than a static file server.

1. Build: `npm run build` (output: `.next/`).
2. Run: `npm run start` (Node 20+; port 5173, or set `PORT`). Run it under your process manager.
3. Put a reverse proxy in front for TLS and the hostname: `deploy/nginx.conf`. A refresh on `/customer/CUST-1001` is served by Next
   itself - no `index.html` fallback is needed or wanted.
4. Restrict access with the host's own sign-in (SSO) or network rules; the app's login is a demo and is not a security boundary.

Build-time flags are `NEXT_PUBLIC_*` (see `.env.example`); serve under a sub-path with `NEXT_PUBLIC_BASE_PATH` and Next's `basePath`.
