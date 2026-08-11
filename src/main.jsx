import { Component, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import Dashboard from './components/Dashboard.jsx'
import Archives from './components/Archives.jsx'

// ルート直下のエラーバウンダリ。
// 描画中の例外で画面全体が白画面のまま固まるのを防ぎ、復旧案内と再読み込みボタンを出す。
// （過去の不具合で不正な値が localStorage に保存された端末の救済経路でもある）
class RootErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    // 研修会場で講師が原因を確認できるようにコンソールへ残す
    console.error('RootErrorBoundary caught:', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: '48px 24px', maxWidth: '480px', margin: '0 auto', textAlign: 'center', fontFamily: 'sans-serif' }}>
          <div style={{ fontSize: '2rem', marginBottom: '12px' }}>⚠️</div>
          <h2 style={{ fontSize: '1.1rem', color: '#111827', marginBottom: '12px' }}>画面の表示中に問題が発生しました</h2>
          <p style={{ fontSize: '0.85rem', color: '#4B5563', lineHeight: 1.7, marginBottom: '24px' }}>
            お手数ですが、下のボタンで画面を再読み込みしてください。<br />
            入力済みの取引データは端末に保存されています。<br />
            それでも直らない場合は、講師（運営）にこの画面をお見せください。
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{ padding: '12px 28px', fontSize: '0.95rem', fontWeight: 700, color: '#FFFFFF', background: '#2A84FF', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
          >
            画面を再読み込みする
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RootErrorBoundary>
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/archives" element={<Archives />} />
        </Routes>
      </MemoryRouter>
    </RootErrorBoundary>
  </StrictMode>,
)
