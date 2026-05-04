"""
Lafayette — Content Generation Engine (standalone Streamlit demo).

This is a single-purpose Streamlit page that embeds ONLY the Content
Generation Engine demo via iframe. Deploy this as its own Streamlit Cloud
app so you have a dedicated URL for this pitch
(e.g. lafayette-content.streamlit.app).

Streamlit Cloud setup:
    Main file path: studio_app.py
    Secrets:
        STUDIO_URL = "https://your-pastry-service.up.railway.app/dashboard/studio"
"""

from __future__ import annotations

import streamlit as st
import streamlit.components.v1 as components

st.set_page_config(
    page_title="Lafayette · Content Generation Engine",
    page_icon="🎬",
    layout="wide",
    initial_sidebar_state="collapsed",
)

# ─── Brand styling ─────────────────────────────────────────
st.markdown(
    """
    <style>
      .block-container { padding-top: 1.25rem; padding-bottom: 0; max-width: 100%; }
      header[data-testid="stHeader"] { background: transparent; }
      .demo-pill {
        display: inline-block; padding: 0.25rem 0.75rem; border-radius: 999px;
        background: #f3ead4; color: #6a4e1c; font-size: 0.8rem; font-weight: 600;
      }
      .hero-title { font-family: Georgia, "Times New Roman", serif; font-size: 1.9rem; margin: 0.4rem 0 0.2rem; }
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


def get_url() -> str | None:
    try:
        return st.secrets["STUDIO_URL"]
    except (KeyError, FileNotFoundError):
        return None


# ─── Header ────────────────────────────────────────────────
st.markdown(
    """
    <div><span class="demo-pill">Lafayette · Live demo</span></div>
    <h1 class="hero-title">Content Generation Engine</h1>
    <p class="hero-sub">
      Veo 3 video + ElevenLabs narration, all filtered through the BrandBrain
      voice fingerprint so the output sounds like Lafayette — not like generic AI.
    </p>
    """,
    unsafe_allow_html=True,
)

with st.expander("What this demo shows · talking points", expanded=False):
    c1, c2 = st.columns(2)
    with c1:
        st.markdown("**What it shows**")
        st.markdown(
            "- 50 short-form video variants per campaign, generated in parallel by Google Veo 3\n"
            "- Creator-POV narration mode (ElevenLabs TTS muxed with ffmpeg)\n"
            "- BrandBrain — scrapes the client's Instagram + website, builds a voice profile, "
            "then filters every future generation through it\n"
            "- Swipe-to-approve picker, one-click publish to IG / TikTok / Google Posts"
        )
    with c2:
        st.markdown("**Talking points**")
        st.markdown(
            "- BrandBrain is the moat — every other AI video tool produces generic output. This sounds like Lafayette.\n"
            "- Demo mode is on by default so live demos don't burn Veo credits in front of a prospect.\n"
            "- Lafayette's brain is preloaded — pick it from the chip rail to see real approved/banned vocab pulled from their feed."
        )

# ─── Iframe ────────────────────────────────────────────────
url = get_url()
height = st.sidebar.slider("Iframe height (px)", 600, 2000, 1200, 50)

if url:
    components.iframe(url, height=height, scrolling=True)
    st.caption(f"Embedded from `{url}`")
    st.link_button("↗ Open full-screen", url)
else:
    st.markdown(
        """
        <div class="placeholder">
          <h3>Demo not wired up yet.</h3>
          <p>Deploy the Content Generation Engine app to Railway, then add its URL to your Streamlit secrets:</p>
          <p><code>STUDIO_URL = "https://your-content-engine-service.up.railway.app/dashboard/studio"</code></p>
          <p style="margin-top: 1.5rem; color: #888;">See <code>DEPLOY.md</code> in the repo for the Railway walkthrough.</p>
        </div>
        """,
        unsafe_allow_html=True,
    )
