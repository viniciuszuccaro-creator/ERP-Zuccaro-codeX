import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ShieldCheck, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';

// Pequeno componente reutilizável para solicitar 2FA antes de ações sensíveis.
// Uso:
// <TwoFactorAuthPrompt open={open} onClose={()=>setOpen(false)} contexto={{ module:'Financeiro', section:'Caixa', empresa_id, group_id }} onSuccess={(code)=>...} />

export default function TwoFactorAuthPrompt({ open, onClose, contexto = {}, onSuccess }) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setError('');
    const six = code.replace(/\D/g, '').slice(0, 6);
    if (six.length !== 6) { setError('Informe os 6 dígitos.'); return; }
    setLoading(true);
    try {
      const res = await base44.functions.invoke('verifyTotp', { ...contexto, code: six });
      if (res?.data?.ok) {
        onSuccess?.();
        onClose?.();
      } else {
        setError('Código inválido.');
      }
    } catch (_) {
      setError('Falha ao validar o código.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={!!open} onOpenChange={(v)=>{ if (!v) onClose?.(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ShieldCheck className="w-5 h-5" /> Verificação em duas etapas</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Insira o código de 6 dígitos enviado ao seu e-mail (e WhatsApp, se habilitado).</p>
          <Input
            value={code}
            onChange={(e)=> setCode(e.target.value)}
            inputMode="numeric"
            maxLength={6}
            placeholder="000000"
            className="text-center tracking-widest text-lg"
          />
          {error && <div className="text-sm text-red-600">{error}</div>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button onClick={submit} disabled={loading} data-permission="Sistema.Seguranca.executar" data-sensitive>
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Validando...</> : 'Validar código'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
