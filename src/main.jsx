import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'

const recoverLocalStorageIfRequested = () => {
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('reset-local') !== '1') return false;

    [
      'erp_integra_local_db_v1',
      'erp_integra_local_user_v1',
      'erp_integra_base44_snapshot_imported_v1',
      'erp_integra_base44_snapshot_imported_v2',
      'erp_integra_base44_snapshot_imported_v3_core',
      'erp_integra_base44_snapshot_imported_v4_core_merged',
      'erp_integra_base44_snapshot_imported_v5_core_compact',
      'contexto_atual',
      'empresa_atual_id',
      'group_atual_id',
    ].forEach((key) => window.localStorage.removeItem(key));

    params.delete('reset-local');
    const next = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}${window.location.hash || ''}`;
    window.history.replaceState({}, '', next || '/');
    console.info('[erp-local] Banco local do navegador reiniciado.');
    return true;
  } catch (error) {
    console.warn('[erp-local] Falha ao reiniciar dados locais:', error?.message || error);
    return false;
  }
};

recoverLocalStorageIfRequested();

const renderApp = () => {
  ReactDOM.createRoot(document.getElementById('root')).render(
    // <React.StrictMode>
    <App />
    // </React.StrictMode>,
  )
}

renderApp();

if (import.meta.hot) {
  import.meta.hot.on('vite:beforeUpdate', () => {
    window.parent?.postMessage({ type: 'sandbox:beforeUpdate' }, '*');
  });
  import.meta.hot.on('vite:afterUpdate', () => {
    window.parent?.postMessage({ type: 'sandbox:afterUpdate' }, '*');
  });
}
