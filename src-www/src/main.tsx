import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { applyMotion } from './motion';
import './styles.css';

// Animationen-Einstellung (Mehr → Darstellung) vor dem ersten Zeichnen anwenden
applyMotion();

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <App />
    </StrictMode>,
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(() => undefined);
    });
}
