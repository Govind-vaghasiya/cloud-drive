# Cloudflare Tunnel Setup Guide for `drive2.govindvaghasiya.ca`

This guide explains how to expose your **Cloud Drive** instance running on **ZimaOS (Docker)** to the public internet securely through Cloudflare Zero Trust without opening port 80/443 on your home router.

---

## Architecture Flow

```text
[Browser / Client]
       │
       ▼ (HTTPS)
[Cloudflare Edge: drive2.govindvaghasiya.ca]
       │
       ▼ (Encrypted Cloudflare Tunnel / QUIC)
[cloudflared Daemon (ZimaOS or Docker)]
       │
       ▼ (HTTP port 80)
[Caddy Reverse Proxy Container]
       ├──► /api/* & /health ──► [Express App :5000]
       └──► /* (Static Web) ──► [React Frontend :80]
```

---

## Setup Steps in Cloudflare Zero Trust Dashboard

1. **Log in to Cloudflare Dashboard**:
   - Go to [Cloudflare One / Zero Trust Dashboard](https://one.dash.cloudflare.com/).
   - Navigate to **Networks** → **Tunnels**.

2. **Create a New Tunnel**:
   - Click **Add a tunnel**.
   - Select **Cloudflare Tunnel (cloudflared)**.
   - Name your tunnel (e.g. `zimaos-cloud-drive`).
   - Click **Save tunnel**.

3. **Install & Run the Connector**:
   Choose one of the two methods below:

   ### Option A: Using Docker Compose on ZimaOS (Recommended)
   - Copy the Tunnel Token provided in the Cloudflare setup instructions.
   - Paste your token into `.env`:
     ```env
     CLOUDFLARE_TUNNEL_TOKEN=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
     ```
   - In `docker-compose.yml`, uncomment the `cloudflared` service:
     ```yaml
     cloudflared:
       image: cloudflare/cloudflared:latest
       container_name: cloud_drive_cloudflared
       restart: unless-stopped
       command: tunnel --no-autoupdate run
       environment:
         - TUNNEL_TOKEN=${CLOUDFLARE_TUNNEL_TOKEN}
       networks:
         - cloud_drive_net
       depends_on:
         - caddy
     ```

   ### Option B: Running as ZimaOS Native App / Container
   - If running `cloudflared` on the host, point it to `http://<ZIMAOS_LOCAL_IP>:80` or `http://localhost:80`.

4. **Configure Public Hostname**:
   - In the **Public Hostname** tab in Cloudflare Tunnel settings:
     - **Subdomain**: `drive2`
     - **Domain**: `govindvaghasiya.ca`
     - **Path**: *(leave empty)*
     - **Type**: `HTTP`
     - **URL**: `caddy:80` (if using Option A Docker network) or `localhost:80` / `<LOCAL_IP>:80` (if using Option B).
   - Under **Additional application settings** → **HTTP Settings**:
     - Enable **HTTP2 Support**
     - Disable Chunked Encoding: `Off`
     - Connect Timeout: `30s`
   - Save the hostname configuration.

---

## Verifying End-to-End Operation

1. Start the Docker stack on ZimaOS:
   ```bash
   docker compose up -d
   ```
2. Check container status:
   ```bash
   docker compose ps
   ```
3. Visit `https://drive2.govindvaghasiya.ca` in your browser:
   - Should load the **Hello Cloud Drive** status dashboard.
   - Health check will verify connections to Express, PostgreSQL, and Redis.
