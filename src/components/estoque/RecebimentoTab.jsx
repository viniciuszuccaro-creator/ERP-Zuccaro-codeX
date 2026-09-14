import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, PackageCheck, Search, Eye } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import RecebimentoForm from "./RecebimentoForm";
import RecebimentoLegacyDialog from "./RecebimentoLegacyDialog";
import { useWindow } from "@/components/lib/useWindow";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";
import { normalizeRecebimentoAliases } from "@/components/lib/estoqueMovimentoPolicy";
import { toast } from "sonner";

/**
 * @typedef {Record<string, unknown> & {
 *   produto_id: string,
 *   produto_descricao: string,
 *   quantidade_pedida: number,
 *   quantidade_recebida: number,
 *   status_item: string,
 * }} RecebimentoItem
 * @typedef {Record<string, unknown> & {
 *   numero_recebimento?: string,
 *   numero_oc?: string,
 *   ordem_compra_id?: string,
 *   fornecedor?: string,
 *   fornecedor_nome?: string,
 *   data_recebimento?: string,
 *   numero_nf?: string,
 *   nota_fiscal?: string,
 *   itens?: RecebimentoItem[],
 *   itens_recebidos?: RecebimentoItem[],
 *   responsavel_recebimento?: string,
 *   conferente?: string,
 *   observacoes?: string,
 *   status?: string,
 * }} RecebimentoSubmission
 * @typedef {RecebimentoSubmission & {
 *   numero_recebimento: string,
 *   ordem_compra_id: string,
 *   fornecedor: string,
 *   data_recebimento: string,
 *   numero_nf: string,
 *   itens: RecebimentoItem[],
 *   responsavel_recebimento: string,
 *   observacoes: string,
 *   status: string,
 * }} RecebimentoFormData
 * @typedef {Record<string, unknown> & {
 *   id: string,
 *   numero_recebimento?: string,
 *   documento?: string,
 *   fornecedor?: string,
 *   numero_nf?: string,
 *   responsavel_recebimento?: string,
 *   responsavel?: string,
 *   status?: string,
 *   observacoes?: string,
 *   data_recebimento?: string,
 *   itens?: unknown[],
 *   itens_recebidos?: Array<Record<string, unknown> & { produto_descricao?: string }>,
 * }} RecebimentoRecord
 * @typedef {Record<string, unknown> & {
 *   id: string,
 *   numero_oc?: string,
 *   fornecedor_nome?: string,
 *   status?: string,
 *   itens?: Array<Record<string, unknown> & { descricao?: string, quantidade?: number }>,
 * }} OrdemCompraRecord
 * @typedef {Record<string, unknown> & { id: string, codigo?: string, descricao?: string, status?: string }} ProdutoRecord
 * @typedef {{ recebimentos?: RecebimentoRecord[], ordensCompra?: OrdemCompraRecord[], produtos?: ProdutoRecord[] }} RecebimentoTabProps
 */

const createInitialFormData = () => /** @type {RecebimentoFormData} */ ({
  numero_recebimento: `REC-${Date.now()}`,
  ordem_compra_id: "",
  fornecedor: "",
  data_recebimento: new Date().toISOString().split('T')[0],
  numero_nf: "",
  itens: [{ produto_id: "", produto_descricao: "", quantidade_pedida: 0, quantidade_recebida: 0, status_item: "Conforme" }],
  responsavel_recebimento: "",
  observacoes: "",
  status: "Pendente",
});

/** @param {RecebimentoTabProps} props */
export default function RecebimentoTab({ recebimentos = [], ordensCompra = [], produtos = [] }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [viewingRecebimento, setViewingRecebimento] = useState(null);
  const { openWindow } = useWindow();
  const { empresaAtual, grupoAtual, createInContext, updateInContext } = useContextoVisual();
  const { canCreate } = usePermissions();
  const contextoValido = Boolean(empresaAtual?.id || grupoAtual?.id);
  const canCreateRecebimento = canCreate('Estoque', 'Recebimento');
  const [formData, setFormData] = useState(createInitialFormData);

  const queryClient = useQueryClient();

  const createMutation = useMutation({
    /** @param {RecebimentoSubmission} data */
    mutationFn: async (data) => {
      if (!contextoValido) throw new Error("Selecione grupo ou empresa antes de registrar recebimento.");
      if (!canCreateRecebimento) throw new Error("Sem permissao para registrar recebimento.");
      const itensRecebidos = data.itens || data.itens_recebidos || [];
      if (!itensRecebidos.some(item => Number(item.quantidade_recebida) > 0)) {
        throw new Error("Informe ao menos um item recebido com quantidade maior que zero.");
      }
      const { numeroRecebimento, numeroNota, responsavel } = normalizeRecebimentoAliases(data);
      const referenciaRecebimento = numeroRecebimento || String(data.ordem_compra_id || "");
      // Criar recebimento
      await createInContext('MovimentacaoEstoque', {
        tipo_movimentacao: "Entrada",
        origem_movimento: "compra",
        origem_documento_id: data.ordem_compra_id || referenciaRecebimento,
        empresa_id: empresaAtual?.id,
        data_movimentacao: data.data_recebimento,
        documento: numeroNota || referenciaRecebimento,
        responsavel,
        observacoes: `Recebimento: ${referenciaRecebimento}`,
        itens_recebidos: itensRecebidos
      });

      // Atualizar estoque de cada produto
      for (const item of itensRecebidos) {
        const quantidadeRecebida = Number(item.quantidade_recebida || 0);
        if (quantidadeRecebida > 0) {
          const produto = produtos.find(p => p.id === item.produto_id);
          if (produto) {
            await createInContext('MovimentacaoEstoque', {
              empresa_id: empresaAtual?.id,
              produto_id: item.produto_id,
              produto_descricao: item.produto_descricao || item.descricao || produto.descricao,
              tipo_movimentacao: "Entrada",
              origem_movimento: "compra",
              origem_documento_id: data.ordem_compra_id || referenciaRecebimento,
              quantidade: quantidadeRecebida,
              data_movimentacao: data.data_recebimento,
              documento: numeroNota || referenciaRecebimento,
              motivo: "Recebimento de compra",
              responsavel,
              observacoes: data.observacoes
            });
          }
        }
      }

      // Atualizar status da ordem de compra se informada
      if (data.ordem_compra_id) {
        await updateInContext('OrdemCompra', data.ordem_compra_id, {
          status: "Recebida"
        });
      }

      await createInContext('AuditLog', {
        acao: 'Estoque.Recebimento.registrado',
        modulo: 'Estoque',
        entidade: 'MovimentacaoEstoque',
        descricao: `Recebimento registrado: ${numeroRecebimento || numeroNota || 'sem documento'}`,
        dados_novos: {
          ...data,
          quantidade_itens: itensRecebidos.length
        },
        group_id: grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null,
        grupo_id: grupoAtual?.id || empresaAtual?.grupo_id || empresaAtual?.group_id || null,
        empresa_id: empresaAtual?.id || null,
        sucesso: true,
        data_hora: new Date().toISOString()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['movimentacoes'] });
      queryClient.invalidateQueries({ queryKey: ['produtos'] });
      queryClient.invalidateQueries({ queryKey: ['ordensCompra'] });
      setIsDialogOpen(false);
      resetForm();
    },
  });

  const resetForm = () => {
    setFormData(createInitialFormData());
  };

  /** @param {import('react').FormEvent<HTMLFormElement>} e */
  const handleSubmit = (e) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  /** @type {Record<string, string>} */
  const statusColors = {
    'Pendente': 'bg-yellow-100 text-yellow-700',
    'Conferido': 'bg-blue-100 text-blue-700',
    'Aprovado': 'bg-green-100 text-green-700',
    'Divergente': 'bg-red-100 text-red-700'
  };

  const filteredRecebimentos = recebimentos.filter(r => {
    const searchLower = searchTerm.toLowerCase();
    return r.numero_recebimento?.toLowerCase().includes(searchLower) ||
      r.documento?.toLowerCase().includes(searchLower) ||
      r.fornecedor?.toLowerCase().includes(searchLower) ||
      r.numero_nf?.includes(searchLower) ||
      r.responsavel_recebimento?.toLowerCase().includes(searchLower) ||
      r.responsavel?.toLowerCase().includes(searchLower) ||
      r.status?.toLowerCase().includes(searchLower) ||
      r.observacoes?.toLowerCase().includes(searchLower) ||
      r.itens_recebidos?.some(i => i?.produto_descricao?.toLowerCase().includes(searchLower));
  });

  return (
    <div
      className="w-full h-full space-y-6"
      data-permission="Estoque.Recebimento.visualizar"
      data-context-required="group-or-company"
    >
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
          <Input
            placeholder="Buscar por nº recebimento, fornecedor, NF, responsável, produto, status..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
            data-permission="Estoque.Recebimento.visualizar"
            data-action="Estoque.Recebimento.buscar"
            data-context-required="group-or-company"
          />
        </div>

        {canCreateRecebimento && (
          <Button
            className="bg-green-600 hover:bg-green-700"
            disabled={!contextoValido}
            data-permission="Estoque.Recebimento.criar"
            data-action="Estoque.Recebimento.abrirFormulario"
            data-context-required="group-or-company"
            data-sensitive="true"
            onClick={() => openWindow(RecebimentoForm, {
            windowMode: true,
            onSubmit: async (data) => {
              try {
                const user = await base44.auth.me();
                await createMutation.mutateAsync({
                  ...data,
                  conferente: data.conferente || user?.full_name || 'Sistema'
                });
                toast.success("✅ Recebimento registrado!");
              } catch (error) {
                toast.error(error?.message || "Erro ao registrar recebimento");
              }
            }
          }, {
            title: '📦 Novo Recebimento',
            width: 1000,
            height: 700
          })}
        >
            <Plus className="w-4 h-4 mr-2" />
            Registrar Recebimento
          </Button>
        )}

        <RecebimentoLegacyDialog
          formData={formData}
          setFormData={setFormData}
          ordensCompra={ordensCompra}
          produtos={produtos}
          isPending={createMutation.isPending}
          onSubmit={handleSubmit}
        />
      </div>

      <Card className="border-0 shadow-md">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead>Nº Recebimento</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Fornecedor</TableHead>
                <TableHead>NF</TableHead>
                <TableHead>Itens</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRecebimentos.map((rec) => (
                <TableRow key={rec.id} className="hover:bg-slate-50">
                  <TableCell className="font-medium font-mono text-sm">{rec.numero_recebimento}</TableCell>
                  <TableCell>
                    {new Date(rec.data_recebimento || '').toLocaleDateString('pt-BR')}
                  </TableCell>
                  <TableCell>{rec.fornecedor}</TableCell>
                  <TableCell className="font-mono text-sm">{rec.numero_nf || '-'}</TableCell>
                  <TableCell>{rec.itens?.length || 0}</TableCell>
                  <TableCell>{rec.responsavel_recebimento || '-'}</TableCell>
                  <TableCell>
                    <Badge className={statusColors[String(rec.status || '')]}>
                      {rec.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setViewingRecebimento(rec)}
                      data-permission="Estoque.Recebimento.visualizar"
                      data-action="Estoque.Recebimento.visualizarDetalhes"
                      data-context-required="group-or-company"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {filteredRecebimentos.length === 0 && (
          <div className="text-center py-12">
            <PackageCheck className="w-16 h-16 mx-auto mb-4 opacity-30 text-slate-400" />
            <p className="text-slate-500">Nenhum recebimento registrado</p>
          </div>
        )}
      </Card>
    </div>
  );
}
