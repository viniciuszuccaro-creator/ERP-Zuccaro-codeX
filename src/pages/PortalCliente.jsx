import React, { useEffect } from 'react';

export default function portalcliente() {
  useEffect(() => {
    const qs = window.location.search || '';
    const hash = window.location.hash || '';
    window.location.replace('/Dashboard' + qs + hash);
  }, []);
  return (
    <div className="w-full h-full flex items-center justify-center p-6 text-sm text-slate-600">
      Redirecionando para o Dashboard...
    </div>
  );
}
