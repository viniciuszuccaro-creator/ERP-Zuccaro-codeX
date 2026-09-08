import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Receipt, Clipboard, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import {
  buildSegundaViaPortal,
  calcularSaldoPortal,
  filtrarTitulosPortal,
} from '@/components/lib/portalClientePolicy';

export default function BoletosList({ cliente }) {
  const qc = useQueryClient();
  const { data: boletosRaw = [] } = useQuery({
    queryKey: ['portal-boletos', cliente?.id],
    enabled: !!cliente?.id,
    queryFn: async () => base44.entities.ContaReceber.filter({ cliente_id: cliente.id }, '-data_vencimento', 100),
  });

  const boletos = filtrarTitulosPortal(boletosRaw, cliente?.id);
  const saldo = calcularSaldoPortal(boletosRaw, cliente?.id);

  const emitir = useMutation({
    mutationFn: async (titulo) => {
      const decision = buildSegundaViaPortal({ titulo, cliente });
      if (decision.reuse) return decision.record;
      return base44.entities.ContaReceber.update(titulo.id, {
        visivel_no_portal: decision.record.visivel_no_portal,
        url_boleto_pdf: decision.record.url_boleto_pdf,
        linha_digitavel: decision.record.linha_digitavel,
        pix_copia_cola: decision.record.pix_copia_cola,
        portal_segunda_via_em: decision.record.portal_segunda_via_em,
        portal_segunda_via_key: decision.record.portal_segunda_via_key,
        idempotency_key: decision.record.idempotency_key,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['portal-boletos', cliente?.id] });
      qc.invalidateQueries({ queryKey: ['minhas-contas', cliente?.id] });
      qc.invalidateQueries({ queryKey: ['meus-boletos'] });
      toast.success('2ª via e PIX atualizados no portal');
    },
    onError: (error) => toast.error(error?.message || 'Falha ao gerar 2ª via'),
  });

  const copiarPix = async (pix) => {
    try {
      await navigator.clipboard.writeText(pix);
      toast.success('PIX copiado');
    } catch {
      toast.error('Nao foi possivel copiar o PIX');
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3 text-sm">
        <Badge variant="secondary">Abertas: {saldo.quantidade}</Badge>
        <Badge variant="outline">Saldo: R$ {saldo.aberto.toFixed(2)}</Badge>
        {saldo.atrasado > 0 && (
          <Badge className="bg-red-100 text-red-700">Atrasado: R$ {saldo.atrasado.toFixed(2)}</Badge>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        {boletos.map((b) => (
          <Card key={b.id} className="w-full">
            <CardContent className="p-4 flex items-start gap-3">
              <Receipt className="w-5 h-5 mt-0.5 text-primary" />
              <div className="min-w-0 w-full">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-medium truncate">{b.descricao || b.numero_documento || 'Título a receber'}</div>
                  <div className="text-xs text-muted-foreground">Venc.: {b.data_vencimento || '—'}</div>
                </div>
                <div className="text-sm text-muted-foreground">
                  Valor: R$ {Number(b.valor || b.valor_total || 0).toFixed(2)} • Status: {b.status}
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {b.url_boleto_pdf && !String(b.url_boleto_pdf).startsWith('portal://') && (
                    <a className="text-xs underline" href={b.url_boleto_pdf} target="_blank" rel="noreferrer">Baixar Boleto (PDF)</a>
                  )}
                  {b.url_boleto_pdf && String(b.url_boleto_pdf).startsWith('portal://') && (
                    <span className="text-xs text-slate-500">2ª via pronta • linha: {(b.linha_digitavel || '').slice(0, 12)}...</span>
                  )}
                  {b.pix_copia_cola && (
                    <Button variant="outline" size="sm" onClick={() => copiarPix(b.pix_copia_cola)} className="h-8">
                      <Clipboard className="w-3.5 h-3.5" /> Copiar PIX
                    </Button>
                  )}
                  <Button
                    size="sm"
                    onClick={() => emitir.mutate(b)}
                    disabled={emitir.isPending}
                    className="h-8"
                  >
                    <RefreshCw className="w-3.5 h-3.5 mr-1" />
                    {emitir.isPending ? 'Gerando 2ª via...' : (b.pix_copia_cola || b.url_boleto_pdf ? 'Atualizar 2ª via' : 'Emitir 2ª via / PIX')}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {boletos.length === 0 && (
          <div className="text-sm text-muted-foreground">Sem boletos disponíveis.</div>
        )}
      </div>
    </div>
  );
}
