import React, { useEffect, useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, X } from 'lucide-react';
import { a1CertificateApi } from '@/api/httpApiClient';
import { HTTP_CONTEXT_CHANGED } from '@/api/erpHttpSession';
import usePermissions from '@/components/lib/usePermissions';

/** Extracted from the existing fiscal tab; secrets never enter formData/query variables. */
export default function CertificadoA1Panel({ scope, metadata, ready, onUploaded }) {
  const file = useRef(null), password = useRef(null), operation = useRef(null);
  const alive = useRef(false), busy = useRef(false);
  const generation = useRef(0);
  const [pending, setPending] = useState(false), [error, setError] = useState('');
  const [result, setResult] = useState('');
  const inputId = useId();
  const { hasPermission } = usePermissions();
  const allowed = hasPermission('Fiscal', 'certificado', 'importar');
  useEffect(() => {
    alive.current = true;
    generation.current++;
    const clear = () => {
      generation.current++;
      operation.current?.abort();
      operation.current = null; busy.current = false;
      if (file.current) file.current.value = '';
      if (password.current) password.current.value = '';
    };
    if (!allowed || !ready) clear();
    setPending(false); setResult('');
    const onContext = () => { clear(); if (alive.current) { setPending(false); setResult(''); setError('Contexto alterado. Reabra o certificado da empresa.'); } };
    window.addEventListener(HTTP_CONTEXT_CHANGED, onContext);
    return () => { alive.current = false; clear(); window.removeEventListener(HTTP_CONTEXT_CHANGED, onContext); };
  }, [scope.groupId, scope.empresaId, scope.actorId, allowed, ready]);

  function cancel() {
    generation.current++; operation.current?.abort(); operation.current = null;
    busy.current = false; setPending(false); setResult('');
    if (file.current) file.current.value = '';
    if (password.current) password.current.value = '';
    setError('Envio interrompido. Consulte o cofre antes de tentar novamente.');
  }

  async function upload() {
    if (busy.current || !allowed || !ready) return;
    const certificate = file.current?.files?.[0];
    if (!certificate) { setError('Selecione um arquivo .pfx ou .p12.'); return; }
    const controller = new AbortController();
    const epoch = generation.current;
    operation.current = controller; busy.current = true; setPending(true); setError(''); setResult('');
    try {
      await a1CertificateApi.upload(scope, { file: certificate, password: password.current?.value || '',
        operationId: crypto.randomUUID(), ...(metadata ? { replaces: { id: metadata.id, revision: metadata.revision } } : {}) },
      { signal: controller.signal });
      if (alive.current && generation.current === epoch && !controller.signal.aborted) {
        setResult('Certificado validado e armazenado no cofre. Esta acao nao habilita emissao fiscal.');
        try { await onUploaded(); }
        catch { if (alive.current && generation.current === epoch) setError('Arquivo armazenado. Metadados indisponiveis; reabra o cofre para conferir.'); }
      }
    } catch {
      if (alive.current && generation.current === epoch && !controller.signal.aborted) setError('Envio nao confirmado. Consulte o cofre antes de tentar novamente.');
    } finally {
      if (generation.current === epoch) {
        if (file.current) file.current.value = '';
        if (password.current) password.current.value = '';
        operation.current = null; busy.current = false;
        if (alive.current) setPending(false);
      }
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
    {pending && <Button type="button" variant="ghost" onClick={cancel}><X className="w-4 h-4 mr-2" />Cancelar envio</Button>}
    {pending && <p role="status" className="text-sm">Validando arquivo e protecao do certificado...</p>}
    {metadata && <p className="text-sm">Validade: {new Date(metadata.validTo).toLocaleDateString('pt-BR')}</p>}
    {metadata && <div className="space-y-1 text-sm min-w-0">
      <p>Situacao no cofre: {metadata.state === 'ACTIVE' ? 'Validado' : metadata.state === 'SUPERSEDED' ? 'Substituido' : 'Revogado localmente'}</p>
      <p className="break-all">Impressao digital: {metadata.fingerprint}</p>
      <p>Cadeia verificada: {metadata.trustStoreVersion}</p>
    </div>}
    {result && <p role="status" className="text-sm">{result}</p>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
  </div>;
}
