import React from 'react';
import ReactDOM from 'react-dom/client';
import '../app/globals.css';
import AuthGate from '../app/auth-gate';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthGate />
  </React.StrictMode>,
);
