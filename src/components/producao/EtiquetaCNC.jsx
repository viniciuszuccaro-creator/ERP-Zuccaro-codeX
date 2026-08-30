import React, { useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Printer, Download } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import { useUser } from "@/components/lib/UserContext";
import usePermissions from "@/components/lib/usePermissions";

export default function EtiquetaCNC({ item, pedido }) {
  const etiquetaRef = useRef();
  const { toast } = useToast();
  const { empresaAtual, grupoAtual } = useContextoVisual();
  const { user } = useUser();
  const { hasPermission } = usePermissions();
  const empresaId = pedido?.empresa_id || item?.empresa_id || empresaAtual?.id || null;
  const groupId = pedido?.group_id || pedido?.grupo_id || item?.group_id || item?.grupo_id || grupoAtual?.id || empresaAtual?.group_id || null;
  const contextoValido = Boolean(groupId || empresaId);
  const podeExportarEtiqueta = hasPermission("Producao", "Documentos", "exportar") ||
    hasPermission("Producao", "Etiquetas", "exportar") ||
    hasPermission("Produção", "Documentos", "exportar") ||
    hasPermission("Produção", "Etiquetas", "exportar") ||
    hasPermission("Producao", null, "exportar");

  const auditarEtiqueta = async ({ acao, descricao, sucesso = true, dadosNovos = {} }) => {
    try {
      await base44.entities.AuditLog.create({
        usuario_id: user?.id,
        usuario: user?.full_name || user?.email || "Usuario",
        acao,
        modulo: "Producao",
        tipo_auditoria: sucesso ? "operacional" : "seguranca",
        entidade: "EtiquetaCNC",
        registro_id: item?.id || pedido?.id,
        descricao,
        empresa_id: empresaId,
        group_id: groupId,
        grupo_id: groupId,
        sucesso,
        dados_novos: dadosNovos,
        detalhes: {
          pedido_id: pedido?.id,
          item_id: item?.id,
          tipo_servico: item?.tipo_servico,
          contexto: empresaId ? "empresa" : "grupo",
          ...dadosNovos,
        },
        data_hora: new Date().toISOString(),
      });
    } catch (error) {
      console.warn("Falha ao auditar etiqueta CNC:", error);
    }
  };

  const validarExportacao = async (acao) => {
    if (contextoValido && podeExportarEtiqueta) return true;

    await auditarEtiqueta({
      acao: `${acao}_bloqueado`,
      descricao: "Tentativa de exportar etiqueta CNC sem contexto ou permissao.",
      sucesso: false,
      dadosNovos: { motivo: !contextoValido ? "contexto_obrigatorio" : "permissao_negada" },
    });
    toast({ title: "Acesso negado", description: "Selecione contexto valido e confirme permissao para exportar etiquetas.", variant: "destructive" });
    return false;
  };

  const handleImprimir = async () => {
    if (!(await validarExportacao("EtiquetaCNC.imprimir"))) return;

    window.print();
    await auditarEtiqueta({
      acao: "EtiquetaCNC.imprimir",
      descricao: "Etiqueta CNC enviada para impressao.",
      dadosNovos: { pedido_numero: pedido?.numero_pedido, item_tipo: item?.tipo_servico },
    });
    toast({ title: "Enviando para impressora..." });
  };

  const handleDownloadPDF = async () => {
    if (!(await validarExportacao("EtiquetaCNC.pdf"))) return;

    await auditarEtiqueta({
      acao: "EtiquetaCNC.pdf",
      descricao: "Geracao de PDF da etiqueta CNC solicitada.",
      dadosNovos: { pedido_numero: pedido?.numero_pedido, item_tipo: item?.tipo_servico },
    });
    toast({ title: "Gerando PDF...", description: "Download iniciara em breve" });
    // Aqui voce pode integrar com biblioteca de geracao de PDF
  };
  // Detectar tipo de item (corte/dobra ou armado)
  const isCorteDebra = item.tipo_servico === "corte_dobra";
  const isArmado = item.tipo_servico === "armado";

  return (
    <div className="space-y-4 w-full h-full" data-permission="Producao.Documentos.exportar" data-context-required="true">
      <div className="flex justify-end gap-2 no-print">
        <Button onClick={handleImprimir} disabled={!contextoValido || !podeExportarEtiqueta} data-permission="Producao.Documentos.exportar" data-action="EtiquetaCNC.imprimir" data-context-required="true" data-sensitive className="bg-blue-600">
          <Printer className="w-4 h-4 mr-2" />
          Imprimir
        </Button>
        <Button onClick={handleDownloadPDF} disabled={!contextoValido || !podeExportarEtiqueta} data-permission="Producao.Documentos.exportar" data-action="EtiquetaCNC.pdf" data-context-required="true" data-sensitive variant="outline">
          <Download className="w-4 h-4 mr-2" />
          Download PDF
        </Button>
      </div>

      {/* ETIQUETAS PARA CORTE/DOBRA */}
      {isCorteDebra && item.posicoes && (
        <div ref={etiquetaRef} className="print-area space-y-6">
          {item.posicoes.map((posicao, index) => (
            <Card key={index} className="break-after-page border-4 border-black">
              <CardContent className="p-6">
                {/* Cabeçalho */}
                <div className="text-center border-b-4 border-black pb-4 mb-4">
                  <h1 className="text-4xl font-bold mb-2">ETIQUETA CNC</h1>
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-sm">Pedido: <strong className="text-xl">{pedido?.numero_pedido}</strong></p>
                      <p className="text-sm">Cliente: <strong>{pedido?.cliente_nome}</strong></p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm">Elemento: <strong className="text-2xl">{item.elemento_estrutural}</strong></p>
                      <p className="text-sm">Projeto: <strong>{item.nome_projeto}</strong></p>
                    </div>
                  </div>
                </div>

                {/* Dados da Peça */}
                <div className="grid grid-cols-2 gap-6 mb-6">
                  <div className="border-4 border-black p-4">
                    <p className="text-sm text-gray-600">POSIÇÃO</p>
                    <p className="text-6xl font-black">{posicao.codigo}</p>
                  </div>
                  <div className="border-4 border-black p-4">
                    <p className="text-sm text-gray-600">BITOLA</p>
                    <p className="text-6xl font-black">{posicao.bitola}mm</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6 mb-6">
                  <div className="border-2 border-black p-4">
                    <p className="text-sm text-gray-600">FORMATO</p>
                    <p className="text-2xl font-bold uppercase">{posicao.formato.replace('_', ' ')}</p>
                  </div>
                  <div className="border-2 border-black p-4">
                    <p className="text-sm text-gray-600">QUANTIDADE</p>
                    <p className="text-4xl font-bold">{posicao.quantidade_barras} x {item.quantidade_elementos} = {posicao.quantidade_barras * item.quantidade_elementos} barras</p>
                  </div>
                </div>

                {/* Medidas */}
                <div className="border-4 border-black p-4 mb-6">
                  <p className="text-lg font-bold mb-2">MEDIDAS (cm)</p>
                  <div className="grid grid-cols-3 gap-4">
                    {Object.entries(posicao.medidas || {}).map(([key, value]) => (
                      <div key={key} className="bg-yellow-100 p-3 border-2 border-black">
                        <p className="text-xs uppercase">{key.replace('_', ' ')}</p>
                        <p className="text-3xl font-black">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Peso */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-blue-100 border-2 border-black p-3">
                    <p className="text-sm">Peso Unitário</p>
                    <p className="text-2xl font-bold">{posicao.peso_unitario?.toFixed(2)} kg</p>
                  </div>
                  <div className="bg-green-100 border-2 border-black p-3">
                    <p className="text-sm">Peso Total</p>
                    <p className="text-2xl font-bold">{posicao.peso_total?.toFixed(2)} kg</p>
                  </div>
                </div>

                {/* Observações */}
                {posicao.observacoes && (
                  <div className="bg-red-100 border-2 border-red-600 p-3">
                    <p className="text-sm font-bold text-red-800">⚠️ ATENÇÃO:</p>
                    <p className="text-lg">{posicao.observacoes}</p>
                  </div>
                )}

                {posicao.variavel && (
                  <div className="bg-orange-100 border-2 border-orange-600 p-3 mt-2">
                    <p className="text-lg font-bold text-orange-800">📏 MEDIDA VARIÁVEL</p>
                  </div>
                )}

                {/* Rodapé */}
                <div className="mt-6 pt-4 border-t-2 border-black flex justify-between text-sm">
                  <p>Data: {new Date().toLocaleDateString('pt-BR')}</p>
                  <p>Seq: {index + 1}/{item.posicoes.length}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ETIQUETAS PARA ARMADO */}
      {isArmado && (
        <div ref={etiquetaRef} className="print-area">
          <Card className="border-4 border-black">
            <CardContent className="p-8">
              {/* Cabeçalho */}
              <div className="text-center border-b-4 border-black pb-4 mb-6">
                <h1 className="text-5xl font-bold mb-2">ETIQUETA ARMAÇÃO</h1>
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm">Pedido: <strong className="text-2xl">{pedido?.numero_pedido}</strong></p>
                    <p className="text-sm">Cliente: <strong className="text-xl">{pedido?.cliente_nome}</strong></p>
                  </div>
                  <div className="text-right">
                    <Badge className="text-3xl py-2 px-6 bg-blue-600">{item.tipo_peca?.toUpperCase()}</Badge>
                  </div>
                </div>
              </div>

              {/* Identificador */}
              <div className="border-4 border-black p-6 mb-6 text-center bg-yellow-100">
                <p className="text-lg text-gray-600">IDENTIFICADOR</p>
                <p className="text-8xl font-black">{item.identificador}</p>
              </div>

              {/* Dados Principais */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="border-4 border-black p-4 text-center">
                  <p className="text-sm text-gray-600">QUANTIDADE</p>
                  <p className="text-5xl font-black">{item.quantidade}</p>
                </div>
                <div className="border-4 border-black p-4 text-center">
                  <p className="text-sm text-gray-600">COMPRIMENTO</p>
                  <p className="text-5xl font-black">{item.comprimento} cm</p>
                </div>
                <div className="border-4 border-black p-4 text-center">
                  <p className="text-sm text-gray-600">BITOLA PRINCIPAL</p>
                  <p className="text-5xl font-black">{item.bitola_principal}mm</p>
                </div>
              </div>

              {/* Ferro Principal */}
              <div className="border-4 border-black p-4 mb-6 bg-blue-50">
                <h3 className="text-2xl font-bold mb-3">🔩 FERRO PRINCIPAL</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm">Quantidade de Ferros</p>
                    <p className="text-3xl font-bold">{item.quantidade_ferros_principais}</p>
                  </div>
                  <div>
                    <p className="text-sm">Dobra Lado 1</p>
                    <p className="text-3xl font-bold">{item.dobra_lado1} cm</p>
                  </div>
                  <div>
                    <p className="text-sm">Dobra Lado 2</p>
                    <p className="text-3xl font-bold">{item.dobra_lado2} cm</p>
                  </div>
                </div>
              </div>

              {/* Estribos */}
              <div className="border-4 border-black p-4 mb-6 bg-purple-50">
                <h3 className="text-2xl font-bold mb-3">🔄 ESTRIBOS</h3>
                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm">Bitola</p>
                    <p className="text-3xl font-bold">{item.estribo_bitola}mm</p>
                  </div>
                  {item.tipo_peca === "estaca" ? (
                    <div>
                      <p className="text-sm">Diâmetro</p>
                      <p className="text-3xl font-bold">{item.estribo_diametro} cm</p>
                    </div>
                  ) : (
                    <>
                      <div>
                        <p className="text-sm">Largura</p>
                        <p className="text-3xl font-bold">{item.estribo_largura} cm</p>
                      </div>
                      <div>
                        <p className="text-sm">Altura</p>
                        <p className="text-3xl font-bold">{item.estribo_altura} cm</p>
                      </div>
                    </>
                  )}
                  <div>
                    <p className="text-sm">Distância</p>
                    <p className="text-3xl font-bold">{item.distancia_estribos} cm</p>
                  </div>
                </div>
                <div className="mt-3 p-3 bg-white border-2 border-black">
                  <p className="text-sm">Quantidade Total de Estribos</p>
                  <p className="text-4xl font-black text-purple-700">{item.quantidade_estribos}</p>
                </div>
              </div>

              {/* Peso e Materiais */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="border-4 border-green-600 p-4 bg-green-50">
                  <p className="text-sm">PESO TOTAL</p>
                  <p className="text-5xl font-black text-green-700">{item.peso_total?.toFixed(2)} kg</p>
                </div>
                <div className="border-4 border-gray-600 p-4 bg-gray-50">
                  <p className="text-sm">ARAME RECOZIDO</p>
                  <p className="text-5xl font-black text-gray-700">{item.peso_arame_recozido?.toFixed(2)} kg</p>
                </div>
              </div>

              {/* Tempo Estimado */}
              <div className="border-4 border-orange-600 p-4 bg-orange-50 mb-6">
                <p className="text-sm">⏱️ TEMPO ESTIMADO DE PRODUÇÃO</p>
                <p className="text-5xl font-black text-orange-700">{item.tempo_estimado_horas}h</p>
              </div>

              {/* Rodapé */}
              <div className="pt-4 border-t-4 border-black">
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="font-bold">Data Emissão:</p>
                    <p>{new Date().toLocaleDateString('pt-BR')}</p>
                  </div>
                  <div className="text-center">
                    <p className="font-bold">Responsável:</p>
                    <p>_________________________</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">Visto Qualidade:</p>
                    <p>_________________________</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <style>{`
        @media print {
          .no-print {
            display: none !important;
          }
          .print-area {
            width: 100%;
          }
          .break-after-page {
            page-break-after: always;
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
