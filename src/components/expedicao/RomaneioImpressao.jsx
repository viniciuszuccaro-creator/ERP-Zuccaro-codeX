import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Printer, Download } from "lucide-react";

/**
 * Componente de impressão de Romaneio de Carga
 * Layout profissional para impressão
 */
export default function RomaneioImpressao({ romaneio, entregas, empresa }) {
  const handleImprimir = () => {
    window.print();
  };

  const handlePDF = () => {
    // TODO: Integrar com gerador de PDF
    alert("Funcionalidade de PDF em desenvolvimento");
  };

  return (
    <div className="bg-white">
      {/* Botões (não imprimem) */}
      <div className="flex justify-end gap-3 mb-4 print:hidden">
        <Button variant="outline" onClick={handlePDF}>
          <Download className="w-4 h-4 mr-2" />
          Baixar PDF
        </Button>
        <Button onClick={handleImprimir} className="bg-blue-600">
          <Printer className="w-4 h-4 mr-2" />
          Imprimir
        </Button>
      </div>

      {/* Documento Imprimível */}
      <div className="p-8 bg-white text-black print:p-4">
        {/* Cabeçalho */}
        <div className="border-2 border-black p-4 mb-4">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold">{empresa?.nome_fantasia || "EMPRESA"}</h1>
              <p className="text-sm">{empresa?.razao_social}</p>
              <p className="text-sm">CNPJ: {empresa?.cnpj}</p>
              <p className="text-sm">{empresa?.endereco?.logradouro}, {empresa?.endereco?.numero}</p>
              <p className="text-sm">{empresa?.endereco?.cidade}/{empresa?.endereco?.estado} - CEP {empresa?.endereco?.cep}</p>
              <p className="text-sm">Tel: {empresa?.contato?.telefone}</p>
            </div>
            <div className="text-right">
              <h2 className="text-xl font-bold">ROMANEIO DE CARGA</h2>
              <p className="text-lg font-semibold">Nº {romaneio.numero_romaneio}</p>
              <p className="text-sm">Data: {new Date(romaneio.data_romaneio).toLocaleDateString('pt-BR')}</p>
            </div>
          </div>
        </div>

        {/* Dados do Motorista e Veículo */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="border border-black p-3">
            <p className="font-bold text-sm mb-2">MOTORISTA</p>
            <p className="text-sm">Nome: {romaneio.motorista}</p>
            <p className="text-sm">Telefone: {romaneio.motorista_telefone}</p>
            {romaneio.ajudante && <p className="text-sm">Ajudante: {romaneio.ajudante}</p>}
          </div>
          <div className="border border-black p-3">
            <p className="font-bold text-sm mb-2">VEÍCULO</p>
            <p className="text-sm">Tipo: {romaneio.tipo_veiculo}</p>
            <p className="text-sm">Descrição: {romaneio.veiculo}</p>
            <p className="text-sm">Placa: {romaneio.placa}</p>
          </div>
        </div>

        {/* Instruções */}
        {romaneio.instrucoes_motorista && (
          <div className="border border-black p-3 mb-4 bg-yellow-50 print:bg-gray-100">
            <p className="font-bold text-sm mb-1">⚠️ INSTRUÇÕES IMPORTANTES</p>
            <p className="text-sm">{romaneio.instrucoes_motorista}</p>
          </div>
        )}

        {/* Tabela de Entregas */}
        <table className="w-full border-collapse border border-black mb-4">
          <thead>
            <tr className="bg-gray-200 print:bg-gray-300">
              <th className="border border-black p-2 text-xs">Ordem</th>
              <th className="border border-black p-2 text-xs">Pedido</th>
              <th className="border border-black p-2 text-xs">Cliente</th>
              <th className="border border-black p-2 text-xs">Endereço Completo</th>
              <th className="border border-black p-2 text-xs">Contato</th>
              <th className="border border-black p-2 text-xs">Município/UF</th>
              <th className="border border-black p-2 text-xs">Vol</th>
              <th className="border border-black p-2 text-xs">Peso</th>
              <th className="border border-black p-2 text-xs">Obs</th>
            </tr>
          </thead>
          <tbody>
            {entregas.map((entrega, idx) => (
              <tr key={entrega.id}>
                <td className="border border-black p-2 text-center text-sm font-bold">{idx + 1}</td>
                <td className="border border-black p-2 text-sm">{entrega.numero_pedido || '-'}</td>
                <td className="border border-black p-2 text-sm">{entrega.cliente_nome}</td>
                <td className="border border-black p-2 text-xs">
                  {entrega.endereco_entrega_completo?.logradouro}, {entrega.endereco_entrega_completo?.numero}
                  {entrega.endereco_entrega_completo?.complemento && ` - ${entrega.endereco_entrega_completo?.complemento}`}
                  <br />
                  {entrega.endereco_entrega_completo?.bairro}
                  <br />
                  CEP: {entrega.endereco_entrega_completo?.cep}
                </td>
                <td className="border border-black p-2 text-xs">
                  {entrega.contato_entrega?.nome || '-'}
                  <br />
                  📞 {entrega.contato_entrega?.whatsapp || entrega.contato_entrega?.telefone || '-'}
                </td>
                <td className="border border-black p-2 text-sm">
                  {entrega.endereco_entrega_completo?.cidade}/{entrega.endereco_entrega_completo?.estado}
                </td>
                <td className="border border-black p-2 text-center text-sm">{entrega.volumes || 0}</td>
                <td className="border border-black p-2 text-center text-sm">{entrega.peso_total_kg?.toFixed(0) || 0}</td>
                <td className="border border-black p-2 text-xs">
                  {entrega.contato_entrega?.instrucoes_especiais || '-'}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-gray-200 print:bg-gray-300 font-bold">
              <td colSpan="6" className="border border-black p-2 text-right">TOTAIS:</td>
              <td className="border border-black p-2 text-center">{entregas.reduce((s, e) => s + (e.volumes || 0), 0)}</td>
              <td className="border border-black p-2 text-center">{entregas.reduce((s, e) => s + (e.peso_total_kg || 0), 0).toFixed(0)}</td>
              <td className="border border-black p-2"></td>
            </tr>
          </tfoot>
        </table>

        {/* Checklist */}
        <div className="border border-black p-3 mb-4">
          <p className="font-bold text-sm mb-2">✅ CHECKLIST DE SAÍDA</p>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border border-black"></div>
              <span>Notas Fiscais (DANFE)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border border-black"></div>
              <span>Romaneio de Carga</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border border-black"></div>
              <span>EPIs do Motorista</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border border-black"></div>
              <span>Combustível OK</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border border-black"></div>
              <span>Carga Conferida</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border border-black"></div>
              <span>Documentos do Veículo</span>
            </div>
          </div>
        </div>

        {/* Assinaturas */}
        <div className="grid grid-cols-3 gap-4 mt-8">
          <div className="text-center">
            <div className="border-t border-black pt-2 mt-12">
              <p className="text-xs">Motorista</p>
              <p className="text-xs font-bold">{romaneio.motorista}</p>
            </div>
          </div>
          <div className="text-center">
            <div className="border-t border-black pt-2 mt-12">
              <p className="text-xs">Conferente</p>
            </div>
          </div>
          <div className="text-center">
            <div className="border-t border-black pt-2 mt-12">
              <p className="text-xs">Responsável Expedição</p>
            </div>
          </div>
        </div>

        {/* Rodapé */}
        <div className="mt-6 text-center text-xs text-gray-600">
          <p>Emitido em {new Date().toLocaleString('pt-BR')}</p>
          <p>Sistema ERP Integra - Gestão Empresarial Integrada</p>
        </div>
      </div>

      {/* Estilos de Impressão */}
      <style>{`
        @media print {
          body { margin: 0; }
          .print\\:hidden { display: none !important; }
          .print\\:p-4 { padding: 1rem; }
          .print\\:bg-gray-100 { background-color: #f3f4f6; }
          .print\\:bg-gray-300 { background-color: #d1d5db; }
        }
      `}</style>
    </div>
  );
}
