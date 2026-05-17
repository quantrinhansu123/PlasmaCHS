import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

console.log('🚀 App is starting...');

try {
  const root = ReactDOM.createRoot(document.getElementById('root'));
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
  console.log('✅ App rendered successfully');
} catch (error) {
  console.error('❌ Error rendering app:', error);
  document.getElementById('root').innerHTML = `
    <div style="padding: 20px; font-family: Roboto, Arial, sans-serif;">
      <h1 style="color: red;">Lỗi khi khởi động ứng dụng</h1>
      <pre style="background: #f5f5f5; padding: 10px; border-radius: 5px;">${error.toString()}</pre>
      <button onclick="window.location.reload()" style="margin-top: 10px; padding: 10px 20px; background: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer;">
        Tải lại trang
      </button>
    </div>
  `;
}
