
import React, { useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Printer, Download, FileText } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { base44 } from "@/api/base44Client";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";
import { useUser } from "@/components/lib/UserContext";

export default function DocumentosProducao({ pedido, itensProducao }) {
  const docRef = useRef();
  const { toast } = useToast();
  const { empresaAtual, grupoAtual } = useContextoVisual();
  const { hasPermission } = usePermissions();
  const { user } = useUser();
  const empresaId = pedido?.empresa_id || empresaAtual?.id || null;
  const groupId = pedido?.group_id || pedido?.grupo_id || grupoAtual?.id || empresaAtual?.group_id || null;
  const contextoValido = Boolean(groupId || empresaId);
  const podeExportarDocumento = hasPermission("Produção", "Documentos", "exportar") ||
    hasPermission("Produção", "Documentos", "visualizar") ||
    hasPermission("Producao", "Documentos", "exportar") ||
    hasPermission("Producao", "Documentos", "visualizar") ||
    hasPermission("Producao", null, "exportar");

  const auditarDocumento = async ({ acao, descricao, sucesso = true, dadosNovos = null }) => {
    try {
      await base44.entities.AuditLog.create({
        usuario: user?.full_name || user?.email || "Usuario local",
        usuario_id: user?.id || null,
        empresa_id: empresaId,
        group_id: groupId,
        grupo_id: groupId,
        acao,
        modulo: "Produção",
        entidade: "DocumentoProducao",
        registro_id: pedido?.id || null,
        tipo_auditoria: sucesso ? "ui" : "seguranca",
        descricao,
        dados_novos: dadosNovos,
        sucesso,
        data_hora: new Date().toISOString()
      });
    } catch (error) {
      console.warn("Falha ao auditar documento de produção:", error);
    }
  };

  const handleImprimir = async () => {
    if (!contextoValido || !podeExportarDocumento) {
      await auditarDocumento({ acao: "DocumentoProducao.bloqueado", descricao: "Tentativa de imprimir documento sem contexto ou permissão.", sucesso: false, dadosNovos: { pedido_id: pedido?.id, numero_pedido: pedido?.numero_pedido } });
      toast({ title: "Acesso negado", description: "Selecione um contexto válido e confirme sua permissão para imprimir.", variant: "destructive" });
      return;
    }
    await auditarDocumento({ acao: "Impressão", descricao: "Impressão de documentos de produção acionada.", dadosNovos: { pedido_id: pedido?.id, numero_pedido: pedido?.numero_pedido, itens: Array.isArray(itensProducao) ? itensProducao.length : 0 } });
    window.print();
    toast({ title: "🖨️ Enviando para impressora..." });
  };

  const handleDownloadPDF = async () => {
    if (!contextoValido || !podeExportarDocumento) {
      await auditarDocumento({ acao: "DocumentoProducao.bloqueado", descricao: "Tentativa de gerar PDF sem contexto ou permissão.", sucesso: false, dadosNovos: { pedido_id: pedido?.id, numero_pedido: pedido?.numero_pedido } });
      toast({ title: "Acesso negado", description: "Selecione um contexto válido e confirme sua permissão para gerar PDF.", variant: "destructive" });
      return;
    }
    await auditarDocumento({ acao: "Exportação", descricao: "Geração de PDF de documentos de produção acionada.", dadosNovos: { pedido_id: pedido?.id, numero_pedido: pedido?.numero_pedido, itens: Array.isArray(itensProducao) ? itensProducao.length : 0 } });
    toast({ title: "📄 Gerando PDF...", description: "Download iniciará em breve" });
  };

  // Consolidar materiais por bitola
  const consolidarMateriais = () => {
    const materiais = {};

    // Verificar se itensProducao existe e é array
    if (!Array.isArray(itensProducao)) {
      return {};
    }

    itensProducao.forEach(item => {
      if (item.tipo_servico === "corte_dobra" && item.resumo?.por_bitola) {
        Object.entries(item.resumo.por_bitola).forEach(([bitola, dados]) => {
          if (!materiais[bitola]) {
            materiais[bitola] = { peso: 0, quantidade: 0 };
          }
          materiais[bitola].peso += dados.peso || 0;
          materiais[bitola].quantidade += dados.quantidade || 0;
        });
      } else if (item.tipo_servico === "armado") {
        // Ferro principal
        if (item.bitola_principal) {
          if (!materiais[item.bitola_principal]) {
            materiais[item.bitola_principal] = { peso: 0, quantidade: 0 };
          }
          materiais[item.bitola_principal].peso += item.peso_ferro_principal || 0;
          materiais[item.bitola_principal].quantidade += (item.quantidade_ferros_principais || 0) * (item.quantidade || 1);
        }

        // Estribo
        if (item.estribo_bitola) {
          if (!materiais[item.estribo_bitola]) {
            materiais[item.estribo_bitola] = { peso: 0, quantidade: 0 };
          }
          materiais[item.estribo_bitola].peso += item.peso_estribos || 0;
          materiais[item.estribo_bitola].quantidade += item.quantidade_estribos || 0;
        }
      }
    });

    return materiais;
  };

  const materiais = consolidarMateriais();
  const pesoTotalAco = Object.values(materiais).reduce((sum, m) => sum + (m.peso || 0), 0);
  const pesoTotalArame = Array.isArray(itensProducao) 
    ? itensProducao.reduce((sum, item) => sum + (item.peso_arame_recozido || 0), 0)
    : 0;

  // NOVO: Proteção contra itensProducao undefined
  const itensSeguro = Array.isArray(itensProducao) ? itensProducao : [];

  return (
    <div className="space-y-4 w-full h-full" data-permission="Producao.Documentos.exportar" data-context-required="true">
      <div className="flex justify-end gap-2 no-print">
        <Button onClick={handleImprimir} className="bg-blue-600" disabled={!contextoValido || !podeExportarDocumento} data-permission="Producao.Documentos.exportar" data-action="DocumentosProducao.imprimir" data-sensitive>
          <Printer className="w-4 h-4 mr-2" />
          Imprimir
        </Button>
        <Button onClick={handleDownloadPDF} variant="outline" disabled={!contextoValido || !podeExportarDocumento} data-permission="Producao.Documentos.exportar" data-action="DocumentosProducao.pdf" data-sensitive>
          <Download className="w-4 h-4 mr-2" />
          Download PDF
        </Button>
      </div>

      <Tabs defaultValue="romaneio" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="romaneio">Romaneio</TabsTrigger>
          <TabsTrigger value="roteiro">Roteiro Dobra</TabsTrigger>
          <TabsTrigger value="materiais">Lista Materiais</TabsTrigger>
        </TabsList>

        {/* ROMANEIO */}
        <TabsContent value="romaneio" ref={docRef} className="print-area">
          <Card className="border-2 border-black">
            <CardContent className="p-8">
              {/* Cabeçalho */}
              <div className="text-center border-b-4 border-black pb-6 mb-6">
                <h1 className="text-5xl font-bold mb-4">ROMANEIO DE CARGA</h1>
                <div className="grid grid-cols-2 gap-8 text-left">
                  <div>
                    <p className="text-sm text-gray-600">PEDIDO</p>
                    <p className="text-3xl font-bold">{pedido?.numero_pedido}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">DATA</p>
                    <p className="text-2xl font-bold">{new Date().toLocaleDateString('pt-BR')}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">CLIENTE</p>
                    <p className="text-xl font-bold">{pedido?.cliente_nome}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">VOLUMES</p>
                    <p className="text-3xl font-bold">{pedido?.volumes || 1}</p>
                  </div>
                </div>
              </div>

              {/* Endereço de Entrega */}
              <div className="border-4 border-black p-4 mb-6 bg-blue-50">
                <h3 className="text-2xl font-bold mb-2">📍 ENDEREÇO DE ENTREGA</h3>
                <p className="text-lg">{pedido?.endereco_entrega_principal?.logradouro}, {pedido?.endereco_entrega_principal?.numero}</p>
                <p className="text-lg">{pedido?.endereco_entrega_principal?.bairro} - {pedido?.endereco_entrega_principal?.cidade}/{pedido?.endereco_entrega_principal?.estado}</p>
                <p className="text-lg">CEP: {pedido?.endereco_entrega_principal?.cep}</p>
                {pedido?.endereco_entrega_principal?.contato_telefone && (
                  <p className="text-lg mt-2">📞 Contato: {pedido?.endereco_entrega_principal?.contato_nome} - {pedido?.endereco_entrega_principal?.contato_telefone}</p>
                )}
              </div>

              {/* Itens */}
              <table className="w-full border-2 border-black mb-6">
                <thead className="bg-gray-200">
                  <tr>
                    <th className="border-2 border-black p-3 text-left">ITEM</th>
                    <th className="border-2 border-black p-3 text-left">DESCRIÇÃO</th>
                    <th className="border-2 border-black p-3 text-center">QTD</th>
                    <th className="border-2 border-black p-3 text-right">PESO (kg)</th>
                  </tr>
                </thead>
                <tbody>
                  {itensSeguro.map((item, index) => (
                    <tr key={index} className="border-b-2 border-black">
                      <td className="border-2 border-black p-3 font-bold">{index + 1}</td>
                      <td className="border-2 border-black p-3">
                        <p className="font-bold text-lg">
                          {item.tipo_servico === "corte_dobra" 
                            ? `${item.elemento_estrutural} - ${item.nome_projeto}`
                            : `${item.tipo_peca?.toUpperCase()} ${item.identificador}`
                          }
                        </p>
                        <p className="text-sm text-gray-600">
                          {item.tipo_servico === "corte_dobra" 
                            ? `${item.posicoes?.length || 0} posições`
                            : `Bitola ${item.bitola_principal}mm - ${item.quantidade_estribos} estribos`
                          }
                        </p>
                      </td>
                      <td className="border-2 border-black p-3 text-center text-2xl font-bold">{item.quantidade || 1}</td>
                      <td className="border-2 border-black p-3 text-right text-2xl font-bold">
                        {(item.resumo?.peso_total || item.peso_total || 0).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-green-100 font-bold text-xl">
                    <td colSpan="3" className="border-2 border-black p-3 text-right">PESO TOTAL:</td>
                    <td className="border-2 border-black p-3 text-right">
                      {pedido?.peso_total_kg?.toFixed(2) || 0} kg
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Observações */}
              {pedido?.observacoes_publicas && (
                <div className="border-4 border-orange-600 p-4 bg-orange-50 mb-6">
                  <h3 className="text-xl font-bold mb-2">⚠️ OBSERVAÇÕES</h3>
                  <p className="text-lg">{pedido.observacoes_publicas}</p>
                </div>
              )}

              {/* Assinaturas */}
              <div className="grid grid-cols-3 gap-6 pt-6 border-t-4 border-black">
                <div className="text-center">
                  <p className="mb-4">_________________________</p>
                  <p className="font-bold">Expedição</p>
                </div>
                <div className="text-center">
                  <p className="mb-4">_________________________</p>
                  <p className="font-bold">Motorista</p>
                </div>
                <div className="text-center">
                  <p className="mb-4">_________________________</p>
                  <p className="font-bold">Recebimento</p>
                  <p className="text-sm">Data: ___/___/______</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ROTEIRO DE DOBRA */}
        <TabsContent value="roteiro" className="print-area">
          <Card className="border-2 border-black">
            <CardContent className="p-8">
              <div className="text-center border-b-4 border-black pb-4 mb-6">
                <h1 className="text-5xl font-bold">ROTEIRO DE DOBRA</h1>
                <p className="text-2xl mt-2">Pedido: {pedido?.numero_pedido}</p>
              </div>

              {itensSeguro.filter(item => item.tipo_servico === "corte_dobra" || item.tipo_servico === "armado").map((item, idx) => (
                <div key={idx} className="mb-8 border-4 border-black p-6 break-inside-avoid">
                  <div className="bg-blue-100 p-4 mb-4">
                    <h2 className="text-3xl font-bold">
                      {item.tipo_servico === "corte_dobra" ? item.elemento_estrutural : item.identificador}
                    </h2>
                  </div>

                  {item.tipo_servico === "corte_dobra" && item.posicoes && (
                    <table className="w-full border-2 border-black">
                      <thead className="bg-gray-200">
                        <tr>
                          <th className="border-2 border-black p-2">Posição</th>
                          <th className="border-2 border-black p-2">Bitola</th>
                          <th className="border-2 border-black p-2">Formato</th>
                          <th className="border-2 border-black p-2">Medidas</th>
                          <th className="border-2 border-black p-2">Qtd</th>
                        </tr>
                      </thead>
                      <tbody>
                        {item.posicoes.map((pos, pidx) => (
                          <tr key={pidx} className="border-b-2">
                            <td className="border-2 border-black p-2 text-center font-bold text-2xl">{pos.codigo}</td>
                            <td className="border-2 border-black p-2 text-center text-xl">{pos.bitola}mm</td>
                            <td className="border-2 border-black p-2 text-center">{pos.formato}</td>
                            <td className="border-2 border-black p-2">
                              {Object.entries(pos.medidas || {}).map(([k, v]) => (
                                <span key={k} className="inline-block mr-3">
                                  <strong>{k}:</strong> {v}cm
                                </span>
                              ))}
                            </td>
                            <td className="border-2 border-black p-2 text-center text-xl font-bold">{pos.quantidade_barras * item.quantidade_elementos}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {item.tipo_servico === "armado" && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="border-2 border-black p-3">
                          <p className="font-bold">Ferro Principal</p>
                          <p className="text-xl">{item.bitola_principal}mm - {item.quantidade_ferros_principais} barras</p>
                          <p className="text-sm">Dobra L1: {item.dobra_lado1}cm | L2: {item.dobra_lado2}cm</p>
                        </div>
                        <div className="border-2 border-black p-3">
                          <p className="font-bold">Estribos</p>
                          <p className="text-xl">{item.estribo_bitola}mm - {item.quantidade_estribos} und</p>
                          <p className="text-sm">
                            {item.tipo_peca === "estaca" 
                              ? `Ø ${item.estribo_diametro}cm` 
                              : `${item.estribo_largura}x${item.estribo_altura}cm`
                            }
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* LISTA DE MATERIAIS */}
        <TabsContent value="materiais" className="print-area">
          <Card className="border-2 border-black">
            <CardContent className="p-8">
              <div className="text-center border-b-4 border-black pb-4 mb-6">
                <h1 className="text-5xl font-bold">LISTA DE MATERIAIS</h1>
                <p className="text-2xl mt-2">Pedido: {pedido?.numero_pedido}</p>
              </div>

              {/* Aço por Bitola */}
              <div className="mb-8">
                <h2 className="text-3xl font-bold mb-4 bg-blue-100 p-3">🔩 AÇO CA-50</h2>
                <table className="w-full border-2 border-black">
                  <thead className="bg-gray-200">
                    <tr>
                      <th className="border-2 border-black p-3">BITOLA</th>
                      <th className="border-2 border-black p-3">QUANTIDADE (barras)</th>
                      <th className="border-2 border-black p-3">PESO (kg)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(materiais).sort().map(([bitola, dados]) => (
                      <tr key={bitola} className="border-b-2">
                        <td className="border-2 border-black p-3 text-center text-2xl font-bold">{bitola}mm</td>
                        <td className="border-2 border-black p-3 text-center text-xl">{dados.quantidade}</td>
                        <td className="border-2 border-black p-3 text-right text-xl font-bold">{dados.peso.toFixed(2)}</td>
                      </tr>
                    ))}
                    <tr className="bg-green-100 font-bold text-xl">
                      <td className="border-2 border-black p-3 text-right" colSpan="2">TOTAL AÇO:</td>
                      <td className="border-2 border-black p-3 text-right text-2xl">{pesoTotalAco.toFixed(2)} kg</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Arame Recozido */}
              <div className="border-4 border-black p-4 bg-gray-100">
                <h2 className="text-2xl font-bold mb-2">🔗 ARAME RECOZIDO 18</h2>
                <p className="text-4xl font-black">{pesoTotalArame.toFixed(2)} kg</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <style jsx>{`
        @media print {
          .no-print {
            display: none !important;
          }
          .print-area {
            width: 100%;
          }
          .break-inside-avoid {
            page-break-inside: avoid;
          }
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>
    </div>
  );
}
