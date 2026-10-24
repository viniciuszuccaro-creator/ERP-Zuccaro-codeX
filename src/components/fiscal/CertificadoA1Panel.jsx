import React, { useEffect, useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload } from 'lucide-react';
import { a1CertificateApi } from '@/api/httpApiClient';
import { HTTP_CONTEXT_CHANGED } from '@/api/erpHttpSession';
import usePermissions from '@/components/lib/usePermissions';

/** Extracted from the existing fiscal tab; secrets never enter formData/query variables. */
export default function CertificadoA1Panel({ scope, metadata, ready, onUploaded }) {
  const file = useRef(null), password = useRef(null), operation = useRef(null);
  const alive = useRef(false), busy = useRef(false);
  const [pending, setPending] = useState(false), [error, setError] = useState('');
  const inputId = useId();
  const { hasPermission } = usePermissions();
  const allowed = hasPermission('Fiscal', 'certificado', 'importar');
  useEffect(() => {
    alive.current = true;
    const clear = () => {
      operation.current?.abort();
      if (file.current) file.current.value = '';
      if (password.current) password.current.value = '';
    };
    const onContext = () => { clear(); if (alive.current) setError('Contexto alterado. Reabra o certificado da empresa.'); };
    window.addEventListener(HTTP_CONTEXT_CHANGED, onContext);
    return () => { alive.current = false; clear(); window.removeEventListener(HTTP_CONTEXT_CHANGED, onContext); };
  }, [scope.groupId, scope.empresaId, scope.actorId]);

  async function upload() {
    if (busy.current || !allowed || !ready) return;
    const certificate = file.current?.files?.[0];
    if (!certificate) { setError('Selecione um arquivo .pfx ou .p12.'); return; }
    const controller = new AbortController();
    operation.current = controller; busy.current = true; setPending(true); setError('');
    try {
      await a1CertificateApi.upload(scope, { file: certificate, password: password.current?.value || '',
        operationId: crypto.randomUUID(), ...(metadata ? { replaces: { id: metadata.id, revision: metadata.revision } } : {}) },
      { signal: controller.signal });
      if (alive.current && !controller.signal.aborted) await onUploaded();
    } catch {
      if (alive.current && !controller.signal.aborted) setError('Envio nao confirmado. Consulte o cofre antes de tentar novamente.');
    } finally {
      if (file.current) file.current.value = '';
      if (password.current) password.current.value = '';
      operation.current = null; busy.current = false;
      if (alive.current) setPending(false);
    }
  }

  return <div className="space-y-4">
    <div><Label htmlFor={`${inputId}-file`}>Certificado A1</Label>
      <Input id={`${inputId}-file`} ref={file} type="file" accept=".pfx,.p12" disabled={!allowed || !ready || pending} /></div>
    <div><Label htmlFor={`${inputId}-password`}>Senha do certificado</Label>
      <Input id={`${inputId}-password`} ref={password} type="password" autoComplete="off" disabled={!allowed || !ready || pending} /></div>
    <Button type="button" variant="outline" disabled={!allowed || !ready || pending} onClick={upload}>
      <Upload className="w-4 h-4 mr-2" />{pending ? 'Enviando...' : metadata ? 'Substituir certificado' : 'Enviar certificado'}
    </Button>
    {metadata && <p className="text-sm">Validade: {new Date(metadata.validTo).toLocaleDateString('pt-BR')}</p>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
  </div>;
}
