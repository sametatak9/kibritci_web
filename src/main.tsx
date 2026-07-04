import { Component, StrictMode, type ReactNode } from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

type RootErrorBoundaryState = {
  hasError: boolean;
  message: string;
};

class RootErrorBoundary extends Component<{ children: ReactNode }, RootErrorBoundaryState> {
  state: RootErrorBoundaryState = {
    hasError: false,
    message: '',
  };

  static getDerivedStateFromError(error: unknown): RootErrorBoundaryState {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : 'Bilinmeyen bir uygulama hatası oluştu.',
    };
  }

  componentDidCatch(error: unknown) {
    console.error('RootErrorBoundary:', error);
  }

  clearStorageAndReload = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      // no-op
    }
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#f8fafc', padding: '24px', fontFamily: 'Inter, system-ui, sans-serif' }}>
        <div style={{ maxWidth: '620px', width: '100%', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '20px' }}>
          <h1 style={{ margin: 0, fontSize: '18px', color: '#0f172a' }}>Uygulama başlatılırken hata oluştu</h1>
          <p style={{ marginTop: '10px', color: '#475569', fontSize: '14px' }}>
            Sayfa boş görünüyorsa tarayıcı önbelleği veya eski oturum verisi kaynaklı olabilir.
          </p>
          <div style={{ marginTop: '12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '10px', fontSize: '12px', color: '#334155', wordBreak: 'break-word' }}>
            Teknik detay: {this.state.message || 'Hata mesajı alınamadı.'}
          </div>
          <div style={{ marginTop: '16px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button
              onClick={() => window.location.reload()}
              style={{ border: '1px solid #1d4ed8', background: '#2563eb', color: '#fff', borderRadius: '10px', padding: '8px 12px', fontWeight: 700, cursor: 'pointer' }}
            >
              Sayfayı Yenile
            </button>
            <button
              onClick={this.clearStorageAndReload}
              style={{ border: '1px solid #e2e8f0', background: '#fff', color: '#0f172a', borderRadius: '10px', padding: '8px 12px', fontWeight: 700, cursor: 'pointer' }}
            >
              Önbellek/Oturum Temizle ve Yeniden Aç
            </button>
          </div>
        </div>
      </div>
    );
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </StrictMode>,
);
