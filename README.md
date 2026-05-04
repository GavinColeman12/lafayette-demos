# Lafayette Demos

Paired sales-demo monorepo for Lafayette Grand Café & Bakery (NoHo, NYC). Two Next.js apps, deployed independently to Railway.

## Apps

| Folder | Port | What it is |
|---|---|---|
| `apps/clv-dashboard` | 3001 | Customer Lifetime Value intelligence — pulls Google reviews, segments customers, drafts retention campaigns. |
| `apps/pastry-pipeline` | 3002 | Campaign Studio — Veo 3 video generation, ElevenLabs narration, Imagen 4 stills, plus the **BrandBrain** voice-fingerprint moat. |

## Local development

Install once at the root, then run either or both:

```bash
npm install                    # installs both workspaces

npm run dev:clv                # CLV dashboard only on :3001
npm run dev:pastry             # Pastry studio only on :3002
npm run dev                    # both, in parallel
```

Each app has its own `.env.example` — copy to `.env.local` and fill in keys.

## Deploying

Two layers, deployed independently:

| Layer | What | Where | Why |
|---|---|---|---|
| Apps | The two Next.js demos | **Railway** (one service per app) | Next.js can't run on Streamlit. |
| Hub | Streamlit landing page that iframes both apps | **Streamlit Cloud** | One URL to share with prospects. |

See [`DEPLOY.md`](./DEPLOY.md) for the click-by-click walkthrough for both.

### Streamlit hub locally

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .streamlit/secrets.toml.example .streamlit/secrets.toml
# edit secrets.toml — paste your Railway URLs
streamlit run streamlit_app.py
```

## Repo layout

```
lafayette-demos/
├── README.md
├── DEPLOY.md
├── streamlit_app.py          # Streamlit Cloud entry — hub page that iframes both apps
├── requirements.txt          # streamlit
├── .streamlit/
│   ├── config.toml           # Lafayette theme
│   └── secrets.toml.example  # template for CLV_URL / STUDIO_URL
├── package.json              # npm workspace root, runs both apps locally
├── .gitignore
└── apps/
    ├── clv-dashboard/
    │   ├── railway.json      # Railway build/start config
    │   ├── .env.example
    │   └── ... (Next.js app)
    └── pastry-pipeline/
        ├── railway.json
        ├── nixpacks.toml     # adds ffmpeg to Railway build
        ├── .env.example
        └── ... (Next.js app)
```
