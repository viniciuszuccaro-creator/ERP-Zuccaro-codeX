import React from 'react';
import { ArrowRight, Box, Layers, Pencil, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

/** @typedef {import('./armadoPadraoPolicy.js').ArmadoItem} ArmadoItem */

/**
 * @param {{itens: ArmadoItem[], onConsolidar: () => void, onGerarRevenda: () => void, onEditar: (index: number) => void, onRemover: (index: number) => void}} props
 */
export default function ArmadoPadraoItems({ itens, onConsolidar, onGerarRevenda, onEditar, onRemover }) {
  return (
    <>
      <Card>
        <CardHeader className="bg-slate-50 border-b">
          <CardTitle className="text-base flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center">
            <span>Peças Adicionadas ({itens.length})</span>
            {itens.length > 0 && <div className="flex flex-wrap gap-2">
              <Button onClick={onConsolidar} variant="outline" size="sm" className="border-purple-300 text-purple-600">
                <Layers className="w-4 h-4 mr-2" /> Agrupar por Etapa
              </Button>
              <Button onClick={onGerarRevenda} variant="outline" size="sm">
                <ArrowRight className="w-4 h-4 mr-2" /> Enviar para Aba Revenda
              </Button>
            </div>}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {itens.length > 0 ? (
            <Table className="min-w-[760px]">
              <TableHeader><TableRow className="bg-slate-50">
                <TableHead>ID</TableHead><TableHead>Etapa Obra</TableHead><TableHead>Descrição Técnica</TableHead>
                <TableHead>Qtd</TableHead><TableHead>Peso (kg)</TableHead><TableHead>Preço</TableHead><TableHead className="text-center">Ação</TableHead>
              </TableRow></TableHeader>
              <TableBody>{itens.map((peca, index) => (
                <TableRow key={`${peca.identificador || 'peca'}-${index}`}>
                  <TableCell className="font-mono text-xs">{peca.identificador}</TableCell>
                  <TableCell>{peca.etapa_obra_nome ? <Badge className="bg-purple-100 text-purple-700">{peca.etapa_obra_nome}</Badge> : <span className="text-xs text-slate-400">-</span>}</TableCell>
                  <TableCell className="max-w-md"><p className="text-sm">{peca.descricao_automatica}</p></TableCell>
                  <TableCell>{peca.quantidade}</TableCell>
                  <TableCell className="font-semibold">{peca.peso_total_kg?.toFixed(2)} kg</TableCell>
                  <TableCell className="font-semibold text-green-600">R$ {peca.preco_venda_total?.toFixed(2)}</TableCell>
                  <TableCell className="text-center"><div className="flex items-center justify-center gap-2">
                    <Button variant="ghost" size="icon" onClick={() => onEditar(index)} className="text-blue-600 hover:bg-blue-50" title="Editar Peça"><Pencil className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => onRemover(index)} className="text-red-600 hover:bg-red-50" title="Remover Peça"><Trash2 className="w-4 h-4" /></Button>
                  </div></TableCell>
                </TableRow>
              ))}</TableBody>
            </Table>
          ) : <div className="text-center py-12 text-slate-500"><Box className="w-16 h-16 mx-auto mb-4 opacity-30" /><p>Nenhuma peça adicionada</p><p className="text-sm mt-1">Selecione um tipo de peça acima para começar</p></div>}
        </CardContent>
      </Card>
      {itens.length > 0 && <Card className="border-2 border-green-300 bg-green-50">
        <CardHeader className="bg-green-100 border-b"><CardTitle className="text-base">📊 Resumo de Matéria-Prima (Armado Padrão)</CardTitle></CardHeader>
        <CardContent className="p-6"><ResumoMateriasPrimas itens={itens} /></CardContent>
      </Card>}
    </>
  );
}

/** @param {{itens: ArmadoItem[]}} props */
function ResumoMateriasPrimas({ itens }) {
  /** @type {Record<string, {peso: number, tipo: string}>} */
  const resumo = {};
  itens.forEach((peca) => {
    if (peca.bitola_principal) {
      resumo[peca.bitola_principal] ||= { peso: 0, tipo: 'CA-50' };
      resumo[peca.bitola_principal].peso += (peca.comprimento || 0) * (peca.quantidade_ferros_principais || 0) * (peca.quantidade || 1) * 1.5;
    }
    if (peca.estribo_bitola) {
      resumo[peca.estribo_bitola] ||= { peso: 0, tipo: 'CA-60' };
      resumo[peca.estribo_bitola].peso += (peca.quantidade_estribos || 0) * 0.5;
    }
  });
  return <div className="space-y-2">{Object.entries(resumo).sort().map(([bitola, dados]) => (
    <div key={bitola} className="flex items-center justify-between p-3 bg-white rounded-lg border">
      <div className="flex items-center gap-3"><div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center"><p className="font-bold text-slate-700">{bitola}</p></div><div><p className="font-semibold text-slate-900">Bitola {bitola}</p><p className="text-xs text-slate-600">{dados.tipo}</p></div></div>
      <p className="text-xl font-bold text-green-600">{dados.peso.toFixed(2)} KG</p>
    </div>
  ))}</div>;
}
