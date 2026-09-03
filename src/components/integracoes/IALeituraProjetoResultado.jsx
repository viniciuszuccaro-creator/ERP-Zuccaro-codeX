import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle } from "lucide-react";

export default function IALeituraProjetoResultado({ resultado, onClear }) {
  if (!resultado?.elementos_identificados?.length) return null;

  return (
    <Card className="border-2 border-green-200">
      <CardHeader className="border-b bg-green-50">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Elementos Identificados: {resultado.elementos_identificados.length} Pecas
            </CardTitle>
            <p className="mt-1 text-sm text-slate-600">
              Revisao dos elementos detectados pela inteligencia artificial.
              <span className="ml-2 font-medium">Confianca Media: {resultado.confianca_geral.toFixed(0)}%</span>
            </p>
          </div>
          <Button variant="outline" onClick={onClear}>Limpar Resultados</Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="w-full overflow-x-auto">
          <Table>
            <TableHeader><TableRow className="bg-slate-50">
              <TableHead>Elemento</TableHead><TableHead>Posicao</TableHead><TableHead>Tipo</TableHead>
              <TableHead>Bitola Principal</TableHead><TableHead>Barras</TableHead><TableHead>C (mm)</TableHead>
              <TableHead>L (mm)</TableHead><TableHead>A (mm)</TableHead><TableHead>Estribo</TableHead>
              <TableHead>Espacamento (cm)</TableHead><TableHead>Confianca</TableHead>
            </TableRow></TableHeader>
            <TableBody>{resultado.elementos_identificados.map((peca, idx) => (
              <TableRow key={`${peca.elemento}-${idx}`}>
                <TableCell className="font-medium">{peca.elemento}</TableCell><TableCell>{peca.posicao || '-'}</TableCell>
                <TableCell><Badge variant="outline">{peca.tipo_peca}</Badge></TableCell><TableCell>{peca.bitola_principal}</TableCell>
                <TableCell>{peca.quantidade_barras}</TableCell><TableCell>{peca.comprimento_mm}</TableCell>
                <TableCell>{peca.largura_mm || '-'}</TableCell><TableCell>{peca.altura_mm || '-'}</TableCell>
                <TableCell>{peca.estribo_bitola || '-'}</TableCell><TableCell>{peca.estribo_espacamento || '-'}</TableCell>
                <TableCell><Badge className={peca.confianca >= 90 ? 'bg-green-100 text-green-700' : peca.confianca >= 75 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}>{peca.confianca}%</Badge></TableCell>
              </TableRow>
            ))}</TableBody>
          </Table>
        </div>
        {resultado.observacoes && <div className="border-t bg-slate-50 p-4 text-sm text-slate-700"><strong>Observacoes da IA:</strong> {resultado.observacoes}</div>}
      </CardContent>
    </Card>
  );
}