# Deploying to Railway

Both apps live in this monorepo but deploy as **two independent Railway services** so each gets its own URL, env vars, and scaling.

## One-time setup

1. Push this folder to a GitHub repo (private is fine).
   ```bash
   cd lafayette-demos
   git init
   git add .
   git commit -m "initial monorepo layout"
   gh repo create lafayette-demos --private --source=. --push
   ```

2. In [Railway](https://railway.app), create a new project: **New Project → Deploy from GitHub repo → lafayette-demos**.

## Service 1 — CLV Dashboard

1. Inside the project, click **+ New → GitHub Repo → lafayette-demos**.
2. Open the new service's **Settings**:
   - **Root Directory**: `apps/clv-dashboard`
   - **Watch Paths**: `apps/clv-dashboard/**`
   - Railway will auto-detect `railway.json` inside that folder.
3. **Variables** tab — add:
   - `ANTHROPIC_API_KEY`
4. Railway builds, deploys, and assigns a `*.up.railway.app` URL. Optionally bind a custom domain in **Settings → Networking**.

## Service 2 — Pastry Pipeline

1. Inside the same project, click **+ New → GitHub Repo → lafayette-demos** again.
2. Settings:
   - **Root Directory**: `apps/pastry-pipeline`
   - **Watch Paths**: `apps/pastry-pipeline/**`
3. **Variables** — at minimum:
   - `ANTHROPIC_API_KEY`
   - `STUDIO_DEMO_MODE=1` ← keep this **on** for prospect demos so live calls don't burn Veo / ElevenLabs credits
   - `APIFY_API_TOKEN` (only if you want BrandBrain to scrape live Instagram)
   - The Veo / Gemini / ElevenLabs vars from `.env.example` — only fill these in when you flip demo mode off
4. Deploy. The `nixpacks.toml` in this app adds `ffmpeg` to the build image so creator-POV narration mux works.

## Why two services, not one

- Independent scaling — the studio app is heavier than the CLV dash.
- Independent env vars — Veo / Apify keys never leak to the CLV side.
- Independent URLs — easier to drop one demo into a deck without exposing the other.
- Independent rollbacks — if a studio change breaks something, CLV stays up.

## Health checks

Each `railway.json` defines a healthcheck path:
- CLV: `/`
- Pastry: `/dashboard/studio`

Railway pings these post-deploy to decide if the service is healthy. If you change route names, update both files.

---

## Streamlit hub (the front door)

The Streamlit page at `streamlit_app.py` is the single URL you share with prospects. It iframes both Railway apps so the prospect never has to juggle two links.

### Deploy steps

1. Make sure both Railway services from above are live and you have their public URLs.
2. Go to [share.streamlit.io](https://share.streamlit.io) → **New app**.
3. Connect to your GitHub repo (`lafayette-demos`).
4. **Main file path**: `streamlit_app.py`
5. **Python version**: 3.11
6. Click **Advanced settings → Secrets** and paste:
   ```toml
   CLV_URL = "https://your-clv-service.up.railway.app"
   STUDIO_URL = "https://your-pastry-service.up.railway.app/dashboard/studio"
   ```
7. **Deploy**. You'll get a `*.streamlit.app` URL — that's the link to share.

### Iframe gotcha

Some Next.js apps refuse iframe embedding via the `X-Frame-Options` or `Content-Security-Policy: frame-ancestors` headers. Both demos here use Next.js defaults which allow embedding, but if you ever see a blank pane in the hub, add this to each app's `next.config.js`:

```js
async headers() {
  return [{
    source: "/:path*",
    headers: [
      { key: "Content-Security-Policy", value: "frame-ancestors 'self' https://*.streamlit.app" },
    ],
  }];
},
```

Then redeploy on Railway. If you need to allow embedding from a custom domain, add it to the `frame-ancestors` list.

### Local Streamlit dev

```bash
cd lafayette-demos
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .streamlit/secrets.toml.example .streamlit/secrets.toml
# edit secrets.toml with your Railway URLs (or localhost URLs while testing)
streamlit run streamlit_app.py
```

You can point `CLV_URL` and `STUDIO_URL` at `http://localhost:3001` and `http://localhost:3002/dashboard/studio` for end-to-end local testing.
