import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

const WEBSITE_DISABLED = true;

function MaintenancePage() {
  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '2rem', background: '#f8fafc', color: '#0f172a', fontFamily: 'Inter, system-ui, sans-serif', textAlign: 'center' }}>
      <section>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔒</div>
        <h1 style={{ margin: 0, fontSize: '2rem' }}>Website temporarily unavailable</h1>
        <p style={{ marginTop: '0.75rem', color: '#475569' }}>We are carrying out maintenance. Please check back later.</p>
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {WEBSITE_DISABLED ? <MaintenancePage /> : <App />}
  </StrictMode>,
);
