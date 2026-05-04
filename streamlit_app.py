"""
Lafayette Demos — Streamlit hub.

This page is the "front door" for prospects. The actual demos are two Next.js
apps deployed elsewhere (Railway). This Streamlit app embeds them via iframe
so you have a single shareable URL with a clean demo picker.

Deploy:
    1. Push this repo to GitHub.
    2. streamlit.io/cloud → New app → select repo → main file: streamlit_app.py
    3. In the app's "Advanced settings → Secrets", paste:
           CLV_URL = "https://your-clv-service.up.railway.app"
           STUDIO_URL = "https://your-pastry-service.up.railway.app/dashboard/studio"
       Without these, the page shows a "not deployed yet" placeholder for that demo.
"""

from __future__ import annotations

import streamlit as st
import streamlit.components.v1 as components

# ─── Page config ────────────────────────────────────────────
st.set_page_config(
    page_title="Lafayette Demos",
    page_icon="🥐",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ─── Theme tweaks ────────────────────────────────────────────
st.markdown(
    """
    <style>
      /* tighten default Streamlit padding so iframes feel full-bleed */
      .block-container { padding-top: 1.5rem; padding-bottom: 0; max-width: 100%; }
      header[data-testid="stHeader"] { background: transparent; }
      /* Brand accent: Lafayette gold */
      .demo-pill {
        display: inline-block; padding: 0.25rem 0.75rem; border-radius: 999px;
        background: #f3ead4; color: #6a4e1c; font-size: 0.8rem; font-weight: 600;
        margin-right: 0.5rem;
      }
      .hero-title { font-family: Georgia, "Times New Roman", serif; font-size: 2.2rem; margin-bottom: 0.25rem; }
      .hero-sub { color: #6b6b6b; font-size: 1rem; margin-top: 0; }
      .placeholder {
        background: #fafaf7; border: 1px dashed #c8c8c8; border-radius: 12px;
        padding: 3rem 2rem; text-align: center; color: #555;
      }
      .placeholder code { background: #fff; padding: 2px 6px; border-radius: 4px; }
    </style>
    """,
    unsafe_allow_html=True,
)

# ─── Demo registry ───────────────────────────────────────────
# URLs come from Streamlit secrets so you can swap them per environment
# without committing secrets to the repo.
DEMOS = {
    "🏠 Overview": {
        "kind": "overview",
    },
    "📊 CLV Intelligence Dashboard": {
        "kind": "iframe",
        "url_key": "CLV_URL",
        "tagline": "Pulls Google reviews → segments customers → drafts retention campaigns.",
        "what_it_shows": [
            "Review-driven customer segments (loyalists, lapsing, first-timers)",
            "Per-segment lifetime-value projection",
            "Auto-drafted retention email + SMS copy with one-click send-to-Klaviyo",
            "Anomaly alerts when sentiment shifts",
        ],
        "talking_points": [
            "Lafayette has 1,400+ Google reviews — most restaurants leave that data on the floor.",
            "Segmenting by review behavior surfaces who's worth winning back, not just who's spending now.",
            "Retention copy is grounded in real review language, so it sounds like the brand, not like a template.",
        ],
        "default_height": 1100,
    },
    "🎬 Campaign Studio (Pastry Pipeline)": {
        "kind": "iframe",
        "url_key": "STUDIO_URL",
        "tagline": "Veo 3 video + ElevenLabs narration + the BrandBrain voice-fingerprint moat.",
        "what_it_shows": [
            "50 short-form video variants per campaign, generated in parallel by Google Veo 3",
            "Creator-POV narration mode (ElevenLabs TTS muxed with ffmpeg)",
            "BrandBrain — scrapes the client's Instagram + website, builds a voice profile, "
            "then filters every future generation through it",
            "Swipe-to-approve picker, one-click publish to IG / TikTok / Google Posts",
        ],
        "talking_points": [
            "BrandBrain is the moat — every other AI video tool produces generic output. This sounds like Lafayette.",
            "Demo mode is on by default so live demos don't burn Veo credits in front of a prospect.",
            "Lafayette's brain is preloaded — pick it from the chip rail to see real approved/banned vocab pulled from their feed.",
        ],
        "default_height": 1200,
    },
}


def get_url(secret_key: str) -> str | None:
    """Read URL from Streamlit secrets; fall back to None if not configured."""
    try:
        return st.secrets[secret_key]
    except (KeyError, FileNotFoundError):
        return None


# ─── Sidebar nav ─────────────────────────────────────────────
with st.sidebar:
    st.markdown("### 🥐 Lafayette Demos")
    st.caption("NoHo, NYC · Sales-demo hub")
    st.divider()

    choice = st.radio(
        "Pick a demo",
        options=list(DEMOS.keys()),
        label_visibility="collapsed",
    )

    st.divider()
    st.caption("Iframe height")
    iframe_height = st.slider(
        "px",
        min_value=600,
        max_value=2000,
        value=DEMOS[choice].get("default_height", 1100),
        step=50,
        label_visibility="collapsed",
    )
    st.caption(
        "Tip: if a demo looks cramped, drag the slider up. Each app handles its own "
        "internal scrolling once it's tall enough."
    )

    st.divider()
    with st.expander("Deploy status"):
        for name, cfg in DEMOS.items():
            if cfg["kind"] != "iframe":
                continue
            url = get_url(cfg["url_key"])
            mark = "✅" if url else "⚠️"
            st.write(f"{mark} **{name.split(' ', 1)[1]}**")
            if url:
                st.caption(url)
            else:
                st.caption(f"Set `{cfg['url_key']}` in app secrets")


# ─── Main pane ───────────────────────────────────────────────
selected = DEMOS[choice]

if selected["kind"] == "overview":
    st.markdown(
        """
        <div>
          <span class="demo-pill">Sales hub</span>
          <span class="demo-pill">Lafayette Grand Café & Bakery</span>
        </div>
        <h1 class="hero-title">Two demos. One door.</h1>
        <p class="hero-sub">
          Pick a demo from the sidebar. Each one is a working app — not a slide deck —
          embedded live below.
        </p>
        """,
        unsafe_allow_html=True,
    )
    st.write("")

    col1, col2 = st.columns(2, gap="large")
    with col1:
        st.markdown("### 📊 CLV Intelligence Dashboard")
        st.write(
            "Turns Lafayette's 1,400+ Google reviews into customer segments, lifetime-value "
            "projections, and drafted retention campaigns."
        )
        st.markdown("**Why it lands**")
        st.markdown(
            "- Most restaurants ignore review data. This makes it actionable.\n"
            "- Segments are behavior-driven, not demographic guesses.\n"
            "- Output is a campaign you'd actually send, not a chart you'd ignore."
        )
    with col2:
        st.markdown("### 🎬 Campaign Studio")
        st.write(
            "Generates 50 short-form video variants per campaign with Veo 3, narrated by "
            "ElevenLabs, filtered through a per-client voice fingerprint (BrandBrain)."
        )
        st.markdown("**Why it lands**")
        st.markdown(
            "- BrandBrain is the moat — output sounds like *the client*, not generic AI slop.\n"
            "- Lafayette's brain is preloaded with their real IG vocab.\n"
            "- Demo mode keeps live calls off so you don't burn credits during a pitch."
        )

    st.divider()
    st.caption(
        "Built for Lafayette Grand Café & Bakery. Both demos are deployed independently to "
        "Railway and embedded into this hub via iframe."
    )

elif selected["kind"] == "iframe":
    url = get_url(selected["url_key"])

    st.markdown(
        f"""
        <div>
          <span class="demo-pill">{choice.split(' ', 1)[0]} Live demo</span>
        </div>
        <h2 class="hero-title" style="font-size: 1.6rem;">{choice.split(' ', 1)[1]}</h2>
        <p class="hero-sub">{selected['tagline']}</p>
        """,
        unsafe_allow_html=True,
    )

    with st.expander("What this demo shows · talking points", expanded=False):
        c1, c2 = st.columns(2)
        with c1:
            st.markdown("**What it shows**")
            for item in selected["what_it_shows"]:
                st.markdown(f"- {item}")
        with c2:
            st.markdown("**Talking points**")
            for item in selected["talking_points"]:
                st.markdown(f"- {item}")

    if url:
        components.iframe(url, height=iframe_height, scrolling=True)
        st.caption(f"Embedded from `{url}` · open in a new tab if iframe is blocked.")
        st.link_button("↗ Open full-screen", url, use_container_width=False)
    else:
        st.markdown(
            f"""
            <div class="placeholder">
              <h3>This demo isn't wired up yet.</h3>
              <p>Deploy the app to Railway, then add its URL to your Streamlit secrets:</p>
              <p><code>{selected['url_key']} = "https://your-service.up.railway.app"</code></p>
              <p style="margin-top: 1.5rem; color: #888;">See <code>DEPLOY.md</code> in the repo for the Railway walkthrough.</p>
            </div>
            """,
            unsafe_allow_html=True,
        )
