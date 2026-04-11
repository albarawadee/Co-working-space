import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { WiFiPortal } from './views/portal/WiFiPortal';
import { initializeDefaultData } from './utils';

initializeDefaultData();

const isPortal = window.location.hash === '#portal';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {isPortal ? <WiFiPortal /> : <App />}
  </StrictMode>
);
