# Trigger redeploy

import streamlit as st

import streamlit.components.v1 as components
import os

st.set_page_config(
    page_title="戦略MG 製造業モバイル",
    page_icon="📊",
    layout="wide",
    initial_sidebar_state="collapsed")
st.write("✅ アプリ起動確認: ここに表示されればOK")

# Streamlitの不要なUI（ヘッダー、フッター、マージン）を非表示にし、画面いっぱいに表示
st.markdown("""
    <style>
    #MainMenu {visibility: hidden;}
    footer {visibility: hidden;}
    header {visibility: hidden;}
    .block-container {
        padding-top: 0rem;
        padding-bottom: 0rem;
        padding-left: 0rem;
        padding-right: 0rem;
    }
    iframe {
        border: none;
        width: 100vw;
        height: 100vh;
        background-color: #0b0c10;
    }
    </style>
""", unsafe_allow_html=True)

# ビルドされた単一HTMLファイル（inlined）を読み込んでiframeとして埋め込み
current_dir = os.path.dirname(os.path.abspath(__file__))
build_dir = os.path.join(current_dir, "dist")
html_path = os.path.join(build_dir, "index.html")

if os.path.exists(html_path):
    mg_app = components.declare_component("mg_app", path=build_dir)
    mg_app(default=None)
else:
    st.error(
        f"ビルド済みのHTMLファイルが見つかりません: {html_path}\n"
        "`npm run build` を実行してビルドを生成してください。"
    )
