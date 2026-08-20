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
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen bg-stone-50 dark:bg-stone-900 transition-colors">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-stone-300 dark:border-stone-600 border-t-red-600 dark:border-t-red-400" />
        </div>
      }
    >
      <App />
    </Suspense>
  </React.StrictMode>
);