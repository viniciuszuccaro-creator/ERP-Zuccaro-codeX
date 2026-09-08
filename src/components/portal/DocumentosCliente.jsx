import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileText, Download, Search, CreditCard, Eye, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import {
  applyPortalReadScope,
  buildPortalDocumentoLinks,
  buildSegundaViaPortal,
  filtrarTitulosPortal,
  resolvePortalClienteId,
} from '@/components/lib/portalClientePolicy';

/**
 * V21.5 - Documentos & Boletos COMPLETO
 * ✅ NFes com XML/DANFE download
 * ✅ Boletos com PIX copia-cola
 * ✅ Links de pagamento
 * ✅ Alertas de vencimento
 * ✅ w-full h-full
 */
export default function DocumentosCliente() {
  const [searchTerm, setSearchTerm] = useState('');
  const qc = useQueryClient();

  const { data: contexto = {}, isLoading: loadingCtx } = useQuery({
    queryKey: ['portal-docs-contexto'],
    queryFn: async () => {
      const user = await base44.auth.me();
      const clientes = await base44.entities.Cliente.filter({ portal_usuario_id: user.id });
      const cliente = clientes[0] || null;
      return { user, cliente, clienteId: resolvePortalClienteId(clientes, user) };
    },
  });

  const cliente = contexto.cliente;
  const clienteId = contexto.clienteId;

  const { data: notasFiscais = [], isLoading: loadingNFe } = useQuery({
    queryKey: ['minhas-nfes', clienteId],
    enabled: !!clienteId,
    queryFn: async () => {
      const list = await base44.entities.NotaFiscal.filter({
        cliente_fornecedor_id: clienteId,
      }, '-data_emissao', 100);
      return applyPortalReadScope({
        entityName: 'NotaFiscal',
        portalClienteId: clienteId,
        records: list.map((item) => ({ ...item, cliente_id: item.cliente_id || item.cliente_fornecedor_id })),
      });
    },
  });

  const { data: contasReceber = [], isLoading: loadingBoletos } = useQuery({
    queryKey: ['meus-boletos', clienteId],
    enabled: !!clienteId,
    queryFn: async () => {
      const list = await base44.entities.ContaReceber.filter({ cliente_id: clienteId }, '-data_vencimento', 100);
      return filtrarTitulosPortal(list, clienteId);
    },
  });

  const emitirSegundaVia = useMutation({
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
      qc.invalidateQueries({ queryKey: ['meus-boletos', clienteId] });
      toast.success('2ª via / PIX gerados');
    },
    onError: (error) => toast.error(error?.message || 'Falha na 2ª via'),
  });

  const statusColorBoleto = {
    'Pendente': 'bg-yellow-100 text-yellow-800',
    'Recebido': 'bg-green-100 text-green-800',
    'Atrasado': 'bg-red-100 text-red-800',
    'Cancelado': 'bg-gray-100 text-gray-800',
  };

  const handleDownloadNFe = async (nfe) => {
    try {
      const links = buildPortalDocumentoLinks({ nfe, clienteId });
      if (links.xml) window.open(links.xml, '_blank');
      else toast.error('XML nao disponivel');
    } catch (error) {
      toast.error(error?.message || 'Download bloqueado');
    }
  };

  const handleVisualizarBoleto = (conta) => {
    if (conta.url_boleto_pdf && !String(conta.url_boleto_pdf).startsWith('portal://')) {
      window.open(conta.url_boleto_pdf, '_blank');
    } else if (conta.linha_digitavel) {
      toast.message(`Linha digitavel: ${conta.linha_digitavel}`);
    } else {
      emitirSegundaVia.mutate(conta);
    }
  };

  const handleCopiarPix = async (conta) => {
    try {
      let pix = conta.pix_copia_cola;
      if (!pix) {
        const updated = await emitirSegundaVia.mutateAsync(conta);
        pix = updated.pix_copia_cola;
      }
      await navigator.clipboard.writeText(pix);
      toast.success('Codigo PIX copiado');
    } catch (error) {
      toast.error(error?.message || 'PIX nao disponivel');
    }
  };

  const filteredNFes = notasFiscais.filter(nfe =>
    nfe.numero?.toString().includes(searchTerm) ||
    nfe.chave_acesso?.includes(searchTerm)
  );

  const filteredBoletos = contasReceber.filter(conta =>
    conta.numero_documento?.includes(searchTerm) ||
    conta.descricao?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loadingCtx) {
    return <div className="p-6 text-sm text-slate-500">Carregando documentos do portal...</div>;
  }

  if (!clienteId) {
    return <div className="p-6 text-sm text-amber-700">Usuario sem vinculo de cliente no portal.</div>;
  }

  return (
    <div className="space-y-6 w-full h-full">
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
          <Input
            placeholder="Buscar documentos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <Tabs defaultValue="nfes" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="nfes">
            <FileText className="w-4 h-4 mr-2" />
            Notas Fiscais ({notasFiscais.length})
          </TabsTrigger>
          <TabsTrigger value="boletos">
            <CreditCard className="w-4 h-4 mr-2" />
            Boletos & PIX ({contasReceber.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="nfes" className="space-y-4 mt-6 w-full">
          {loadingNFe ? (
            <p>Carregando notas fiscais...</p>
          ) : (
            <div className="grid gap-4 w-full">
              {filteredNFes.map((nfe) => (
                <Card key={nfe.id} className="hover:shadow-lg transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center">
                          <FileText className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-lg">NF-e Nº {nfe.numero}</h3>
                          <p className="text-sm text-slate-600">
                            Série: {nfe.serie} | Chave: {nfe.chave_acesso?.substring(0, 20)}...
                          </p>
                          <p className="text-sm text-slate-600">
                            Emissão: {new Date(nfe.data_emissao).toLocaleDateString('pt-BR')}
                          </p>
                          <p className="text-sm font-medium text-green-600 mt-1">
                            Valor: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(nfe.valor_total)}
                          </p>
                        </div>
                      </div>
                      <Badge className="bg-green-100 text-green-800">
                        {nfe.status || 'Autorizada'}
                      </Badge>
                    </div>

                    <div className="flex gap-2 mt-4">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDownloadNFe(nfe)}
                        className="flex items-center gap-2"
                      >
                        <Download className="w-4 h-4" />
                        Download XML
                      </Button>
                      {(() => {
                        try {
                          const links = buildPortalDocumentoLinks({ nfe, clienteId });
                          return links.danfe ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => window.open(links.danfe, '_blank')}
                              className="flex items-center gap-2"
                            >
                              <Eye className="w-4 h-4" />
                              Ver DANFE
                            </Button>
                          ) : null;
                        } catch {
                          return null;
                        }
                      })()}
                    </div>
                  </CardContent>
                </Card>
              ))}

              {filteredNFes.length === 0 && (
                <Card>
                  <CardContent className="p-12 text-center">
                    <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-500">Nenhuma nota fiscal encontrada</p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="boletos" className="space-y-4 mt-6 w-full">
          {loadingBoletos ? (
            <p>Carregando boletos...</p>
          ) : (
            <div className="grid gap-4 w-full">
              {filteredBoletos.map((conta) => {
                const isVencido = new Date(conta.data_vencimento) < new Date() && conta.status === 'Pendente';
                const diasAtraso = isVencido ? Math.floor((new Date() - new Date(conta.data_vencimento)) / (1000 * 60 * 60 * 24)) : 0;

                return (
                  <Card key={conta.id} className="hover:shadow-lg transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-start gap-4">
                          <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                            isVencido ? 'bg-red-500' : 'bg-blue-500'
                          }`}>
                            <CreditCard className="w-6 h-6 text-white" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-lg">{conta.descricao}</h3>
                            <p className="text-sm text-slate-600">
                              Doc: {conta.numero_documento || 'N/A'}
                            </p>
                            <p className="text-sm text-slate-600">
                              Vencimento: {new Date(conta.data_vencimento).toLocaleDateString('pt-BR')}
                            </p>
                            {isVencido && (
                              <p className="text-sm font-medium text-red-600 mt-1">
                                ⚠️ Vencido há {diasAtraso} dias
                              </p>
                            )}
                            <p className="text-lg font-bold text-blue-600 mt-2">
                              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(conta.valor)}
                            </p>
                          </div>
                        </div>
                        <Badge className={statusColorBoleto[conta.status] || 'bg-gray-100'}>
                          {conta.status}
                        </Badge>
                      </div>

                      {conta.status === 'Pendente' && (
                        <div className="flex gap-2 flex-wrap">
                          <Button
                            size="sm"
                            onClick={() => handleVisualizarBoleto(conta)}
                            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
                          >
                            <Eye className="w-4 h-4" />
                            {conta.linha_digitavel || conta.url_boleto_pdf ? 'Ver Boleto' : 'Gerar 2ª via'}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleCopiarPix(conta)}
                            className="flex items-center gap-2"
                            disabled={emitirSegundaVia.isPending}
                          >
                            <Download className="w-4 h-4" />
                            {conta.pix_copia_cola ? 'Copiar PIX' : 'Gerar PIX'}
                          </Button>
                          {conta.url_fatura && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => window.open(conta.url_fatura, '_blank')}
                              className="flex items-center gap-2"
                            >
                              <Calendar className="w-4 h-4" />
                              Link de Pagamento
                            </Button>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}

              {filteredBoletos.length === 0 && (
                <Card>
                  <CardContent className="p-12 text-center">
                    <CreditCard className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-500">Nenhum boleto encontrado</p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}