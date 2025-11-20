import React, { Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import './i18n/config'; // Import i18n configuration
import App from './App';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <Suspense fallback={<div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div></div>}>
      <App />
    </Suspense>
  </React.StrictMode>
);