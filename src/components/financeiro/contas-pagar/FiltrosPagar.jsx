import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Download, Plus, CheckCircle2, Send } from 'lucide-react';
import { ProtectedAction } from '@/components/ProtectedAction';
import DuplicarMesAnterior from '../DuplicarMesAnterior';

export default function FiltrosPagar({
  searchTerm,
  setSearchTerm,
  statusFilter,
  setStatusFilter,
  contasSelecionadas,
  totalSelecionado,
  onExportar,
  onBaixarMultipla,
  onNovaConta,
  onEnviarCaixa,
  empresaId,
  baixarPending = false,
  enviarPending = false
}) {
  return (
    <Card className="border-0 shadow-sm min-h-[80px] max-h-[80px]">
      <CardContent className="p-3">
        <div className="flex gap-2">
          <ProtectedAction module="Financeiro" section="ContaPagar" action="exportar">
            <Button variant="outline" size="sm" onClick={onExportar}>
              <Download className="w-3 h-3 mr-1" /> CSV
            </Button>
          </ProtectedAction>

          <Input
            placeholder="Buscar por fornecedor, descrição, documento, CPF/CNPJ, categoria, projeto..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-md h-8"
          />

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-32 h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="Pendente">Pendente</SelectItem>
              <SelectItem value="Aprovado">Aprovado</SelectItem>
              <SelectItem value="Pago">Pago</SelectItem>
              <SelectItem value="Cancelado">Cancelado</SelectItem>
            </SelectContent>
          </Select>

          {contasSelecionadas.length > 0 && (
            <>
              <Badge className="bg-red-100 text-red-700 px-3 py-1">
                {contasSelecionadas.length} • R$ {totalSelecionado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </Badge>
              
              <ProtectedAction module="Financeiro" section="ContaPagar" action="baixar_multiplos">
                <Button variant="outline" size="sm" onClick={onBaixarMultipla} disabled={baixarPending}>
                  <CheckCircle2 className="w-3 h-3 mr-1" /> Pagar
                </Button>
              </ProtectedAction>

              <Button variant="outline" size="sm" onClick={onEnviarCaixa} disabled={enviarPending} className="bg-red-50">
                <Send className="w-3 h-3 mr-1" /> Enviar Caixa
              </Button>
            </>
          )}

          <DuplicarMesAnterior empresaId={empresaId} />
          
          <Button size="sm" onClick={onNovaConta} className="bg-red-600 hover:bg-red-700 ml-auto">
            <Plus className="w-3 h-3 mr-1" /> Nova
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
