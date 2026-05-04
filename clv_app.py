"""
Lafayette — Customer Intelligence Dashboard (standalone Streamlit demo).

This is a single-purpose Streamlit page that embeds ONLY the Customer
Intelligence demo via iframe. Deploy this as its own Streamlit Cloud app so
you have a dedicated URL for this pitch (e.g. lafayette-customer.streamlit.app).

Streamlit Cloud setup:
    Main file path: clv_app.py
    Secrets:
        CLV_URL = "https://your-clv-service.up.railway.app"
"""

from __future__ import annotations

import streamlit as st
import streamlit.components.v1 as components

st.set_page_config(
    page_title="Lafayette · Customer Intelligence",
    page_icon="📊",
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
        return st.secrets["CLV_URL"]
    except (KeyError, FileNotFoundError):
        return None


# ─── Header ────────────────────────────────────────────────
st.markdown(
    """
    <div><span class="demo-pill">Lafayette · Live demo</span></div>
    <h1 class="hero-title">Customer Intelligence Dashboard</h1>
    <p class="hero-sub">
      Pulls Lafayette's Google reviews → segments customers by lifetime value →
      drafts retention campaigns grounded in the brand's actual review language.
    </p>
    """,
    unsafe_allow_html=True,
)

with st.expander("What this demo shows · talking points", expanded=False):
    c1, c2 = st.columns(2)
    with c1:
        st.markdown("**What it shows**")
        st.markdown(
            "- Review-driven customer segments (loyalists, lapsing, first-timers)\n"
            "- Per-segment lifetime-value projection\n"
            "- Auto-drafted retention email + SMS copy with one-click send-to-Klaviyo\n"
            "- Anomaly alerts when sentiment shifts"
        )
    with c2:
        st.markdown("**Talking points**")
        st.markdown(
            "- Lafayette has 1,400+ Google reviews — most restaurants leave that data on the floor.\n"
            "- Segmenting by review behavior surfaces who's worth winning back, not just who's spending now.\n"
            "- Retention copy is grounded in real review language, so it sounds like the brand, not like a template."
        )

# ─── Iframe ────────────────────────────────────────────────
url = get_url()
height = st.sidebar.slider("Iframe height (px)", 600, 2000, 1100, 50)

if url:
    components.iframe(url, height=height, scrolling=True)
    st.caption(f"Embedded from `{url}`")
    st.link_button("↗ Open full-screen", url)
else:
    st.markdown(
        """
        <div class="placeholder">
          <h3>Demo not wired up yet.</h3>
          <p>Deploy the Customer Intelligence app to Railway, then add its URL to your Streamlit secrets:</p>
          <p><code>CLV_URL = "https://your-customer-intel-service.up.railway.app"</code></p>
          <p style="margin-top: 1.5rem; color: #888;">See <code>DEPLOY.md</code> in the repo for the Railway walkthrough.</p>
        </div>
        """,
        unsafe_allow_html=True,
    )
