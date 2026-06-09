import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeftRight, Save, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import usePermissions from "@/components/lib/usePermissions";
import ProtectedField from "@/components/security/ProtectedField";
import { useContextoVisual } from "@/components/lib/useContextoVisual";

/**
 * V21.1.2 - WINDOW MODE READY
 * Formulário de transferência entre empresas do grupo
 */
export default function TransferenciaEntreEmpresasForm({ 
  empresasDoGrupo = [],
  produtos = [],
  onSuccess,
  windowMode = false
}) {
  const queryClient = useQueryClient();
  const { canCreate, hasPermission } = usePermissions();
  const { empresaAtual, grupoAtual, contexto, createInContext } = useContextoVisual();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const contextoValido = Boolean(groupId || empresasDoGrupo.length > 0);
  const canCreateTransferencia = canCreate('Estoque', 'Transferencias') || hasPermission('Estoque', null, 'criar');

  const auditTransferencia = async ({ acao, sucesso = true, motivo = null, dados = {} }) => {
    try {
      await createInContext('AuditLog', {
        acao,
        modulo: 'Estoque',
        entidade: 'TransferenciaFilial',
        tipo_auditoria: sucesso ? 'entidade' : 'seguranca',
        descricao: motivo || 'Auditoria de transferencia entre empresas.',
        dados_novos: dados,
        group_id: groupId || dados.group_id || null,
        grupo_id: groupId || dados.group_id || null,
        empresa_id: dados.empresa_origem_id || empresaAtual?.id || null,
        sucesso,
        data_hora: new Date().toISOString(),
      });
    } catch (error) {
      console.warn('Falha ao auditar transferencia entre empresas:', error);
    }
  };

  const [formData, setFormData] = useState({
    empresa_origem_id: "",
    empresa_destino_id: "",
    produto_id: "",
    quantidade: 0,
    unidade: "",
    motivo: "reequilibrio",
    gerar_financeiro: false,
    observacoes: ""
  });

  const createTransferenciaMutation = useMutation({
    mutationFn: async (data) => {
      const produto = produtos.find(p => p.id === data.produto_id);
      const empresaOrigem = empresasDoGrupo.find(e => e.id === data.empresa_origem_id);
      const empresaDestino = empresasDoGrupo.find(e => e.id === data.empresa_destino_id);

      // Criar registro de transferência
      const transferencia = await createInContext('TransferenciaFilial', {
        group_id: empresaOrigem.group_id,
        empresa_origem_id: data.empresa_origem_id,
        empresa_destino_id: data.empresa_destino_id,
        produto_id: data.produto_id,
        produto_descricao: produto.descricao,
        quantidade: data.quantidade,
        unidade_medida: data.unidade,
        motivo: data.motivo,
        observacoes: data.observacoes,
        valor_unitario: produto.custo_medio || produto.custo_aquisicao || 0,
        valor_total: (produto.custo_medio || produto.custo_aquisicao || 0) * data.quantidade,
        status: "Aprovada",
        data_solicitacao: new Date().toISOString(),
        gerar_cobranca_interna: data.gerar_financeiro
      });

      // Criar movimentações de estoque
      await createInContext('MovimentacaoEstoque', {
        empresa_id: data.empresa_origem_id,
        group_id: empresaOrigem.group_id,
        produto_id: data.produto_id,
        tipo_movimento: "transferencia",
        origem_movimento: "transferencia",
        origem_documento_id: transferencia.id,
        quantidade: -data.quantidade,
        observacoes: `Transferência para ${empresaDestino.nome_fantasia}`,
        data_movimentacao: new Date().toISOString()
      });

      await createInContext('MovimentacaoEstoque', {
        empresa_id: data.empresa_destino_id,
        group_id: empresaDestino.group_id,
        produto_id: data.produto_id,
        tipo_movimento: "transferencia",
        origem_movimento: "transferencia",
        origem_documento_id: transferencia.id,
        quantidade: data.quantidade,
        observacoes: `Transferência de ${empresaOrigem.nome_fantasia}`,
        data_movimentacao: new Date().toISOString()
      });

      await auditTransferencia({
        acao: 'TransferenciaEntreEmpresas.confirmada',
        dados: {
          transferencia_id: transferencia?.id,
          group_id: empresaOrigem.group_id || empresaDestino.group_id || groupId,
          empresa_origem_id: data.empresa_origem_id,
          empresa_destino_id: data.empresa_destino_id,
          produto_id: data.produto_id,
          quantidade: data.quantidade
        }
      });

      return transferencia;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['produtos'] });
      queryClient.invalidateQueries({ queryKey: ['movimentacoes'] });
      queryClient.invalidateQueries({ queryKey: ['transferencias'] });
      toast.success("✅ Transferência realizada com sucesso!");
      if (onSuccess) onSuccess();
      resetForm();
    }
  });

  const resetForm = () => {
    setFormData({
      empresa_origem_id: "",
      empresa_destino_id: "",
      produto_id: "",
      quantidade: 0,
      unidade: "",
      motivo: "reequilibrio",
      gerar_financeiro: false,
      observacoes: ""
    });
  };

  const produtoSelecionado = produtos.find(p => p.id === formData.produto_id);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!contextoValido || !canCreateTransferencia) {
      await auditTransferencia({
        acao: 'TransferenciaEntreEmpresas.bloqueada',
        sucesso: false,
        motivo: !contextoValido ? 'contexto_obrigatorio' : 'permissao_negada',
        dados: { ...formData }
      });
      toast.error(!contextoValido ? "Selecione grupo ou empresa antes de transferir." : "Sem permissão para transferir estoque entre empresas.");
      return;
    }

    if (!formData.empresa_origem_id || !formData.empresa_destino_id) {
      toast.error("Selecione as empresas de origem e destino");
      return;
    }
    
    if (!formData.produto_id) {
      toast.error("Selecione um produto");
      return;
    }
    
    if (formData.quantidade <= 0) {
      toast.error("Quantidade deve ser maior que zero");
      return;
    }

    if (formData.empresa_origem_id === formData.empresa_destino_id) {
      toast.error("Empresa origem e destino devem ser diferentes");
      return;
    }

    const produto = produtos.find(p => p.id === formData.produto_id);
    const empresaOrigem = empresasDoGrupo.find(e => e.id === formData.empresa_origem_id);
    const empresaDestino = empresasDoGrupo.find(e => e.id === formData.empresa_destino_id);
    const confirmado = window.confirm(`Confirma transferir ${formData.quantidade} ${formData.unidade || produto?.unidade_medida || ''} de ${produto?.descricao || 'produto'} de ${empresaOrigem?.nome_fantasia || 'origem'} para ${empresaDestino?.nome_fantasia || 'destino'}?`);
    if (!confirmado) {
      await auditTransferencia({ acao: 'TransferenciaEntreEmpresas.cancelada', sucesso: false, motivo: 'confirmacao_cancelada', dados: { ...formData } });
      return;
    }

    createTransferenciaMutation.mutate(formData);
  };

  const content = (
    <div className={`space-y-6 w-full h-full ${windowMode ? 'p-6 overflow-auto' : ''}`} data-permission="Estoque.Transferencias.criar" data-context-required="group-or-company" data-context-mode={contexto}>
      {!windowMode && (
        <div className="flex items-center gap-2 mb-4">
          <ArrowLeftRight className="w-6 h-6 text-purple-600" />
          <h2 className="text-2xl font-bold">Transferência entre Empresas</h2>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4" data-permission="Estoque.Transferencias.criar" data-action="Estoque.Transferencias.formulario" data-context-required="group-or-company">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Empresa Origem *</Label>
            <Select
              value={formData.empresa_origem_id}
              onValueChange={(v) => setFormData({ ...formData, empresa_origem_id: v })}
            >
              <SelectTrigger data-permission="Estoque.Transferencias.criar" data-action="Estoque.Transferencias.empresaOrigem" data-context-required="group-or-company">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {empresasDoGrupo.map(emp => (
                  <SelectItem key={emp.id} value={emp.id}>
                    {emp.nome_fantasia || emp.razao_social}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Empresa Destino *</Label>
            <Select
              value={formData.empresa_destino_id}
              onValueChange={(v) => setFormData({ ...formData, empresa_destino_id: v })}
            >
              <SelectTrigger data-permission="Estoque.Transferencias.criar" data-action="Estoque.Transferencias.empresaDestino" data-context-required="group-or-company">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {empresasDoGrupo.map(emp => (
                  <SelectItem key={emp.id} value={emp.id}>
                    {emp.nome_fantasia || emp.razao_social}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label>Produto *</Label>
          <Select
            value={formData.produto_id}
            onValueChange={(v) => {
              const prod = produtos.find(p => p.id === v);
              setFormData({ 
                ...formData, 
                produto_id: v,
                unidade: prod?.unidade_medida || ""
              });
            }}
          >
            <SelectTrigger data-permission="Estoque.Transferencias.criar" data-action="Estoque.Transferencias.produto" data-context-required="group-or-company">
              <SelectValue placeholder="Selecione..." />
            </SelectTrigger>
            <SelectContent>
              {produtos.filter(p => p.status === 'Ativo').map(prod => (
                <SelectItem key={prod.id} value={prod.id}>
                  {prod.codigo ? `${prod.codigo} - ` : ''}{prod.descricao}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {produtoSelecionado && (
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="p-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-blue-700">Estoque Atual</p>
                  <p className="font-bold text-blue-900">
                    {produtoSelecionado.estoque_atual || 0} {produtoSelecionado.unidade_medida}
                  </p>
                </div>
                <div>
                  <p className="text-blue-700">Custo Médio</p>
                  <p className="font-bold text-blue-900">
                    <ProtectedField module="Estoque" submodule="Transferencias" field="custo" action="ver" asText>
                      R$ {(produtoSelecionado.custo_medio || produtoSelecionado.custo_aquisicao || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </ProtectedField>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Quantidade *</Label>
            <Input
              type="number"
              step="0.01"
              value={formData.quantidade}
              onChange={(e) => setFormData({ ...formData, quantidade: parseFloat(e.target.value) || 0 })}
              data-permission="Estoque.Transferencias.criar"
              data-action="Estoque.Transferencias.quantidade"
              data-context-required="group-or-company"
            />
          </div>

          <div>
            <Label>Unidade</Label>
            <Input
              value={formData.unidade}
              disabled
              className="bg-slate-100"
              data-permission="Estoque.Transferencias.visualizar"
              data-action="Estoque.Transferencias.unidade"
              data-context-required="group-or-company"
            />
          </div>
        </div>

        <div>
          <Label>Motivo *</Label>
          <Select
            value={formData.motivo}
            onValueChange={(v) => setFormData({ ...formData, motivo: v })}
          >
            <SelectTrigger data-permission="Estoque.Transferencias.criar" data-action="Estoque.Transferencias.motivo" data-context-required="group-or-company">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="reequilibrio">Reequilíbrio de Estoque</SelectItem>
              <SelectItem value="producao">Suprimento para Produção</SelectItem>
              <SelectItem value="emprestimo">Empréstimo Temporário</SelectItem>
              <SelectItem value="devolucao">Devolução de Empréstimo</SelectItem>
              <SelectItem value="outros">Outros</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="gerar-financeiro"
                checked={formData.gerar_financeiro}
                onChange={(e) => setFormData({ ...formData, gerar_financeiro: e.target.checked })}
                className="w-4 h-4"
                data-permission="Estoque.Transferencias.criar"
                data-action="Estoque.Transferencias.gerarFinanceiroInterno"
                data-context-required="group-or-company"
                data-sensitive="true"
              />
              <Label htmlFor="gerar-financeiro" className="cursor-pointer font-normal">
                Gerar financeiro interno (transferência cobra da empresa destino)
              </Label>
            </div>
          </CardContent>
        </Card>

        <div>
          <Label>Observações</Label>
          <Textarea
            value={formData.observacoes}
            onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
            rows={3}
            data-permission="Estoque.Transferencias.criar"
            data-action="Estoque.Transferencias.observacoes"
            data-context-required="group-or-company"
          />
        </div>

        {formData.empresa_origem_id === formData.empresa_destino_id && formData.empresa_origem_id && (
          <Card className="border-red-300 bg-red-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-600" />
                <p className="text-sm text-red-700">
                  <strong>Erro:</strong> Empresa origem e destino não podem ser iguais
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex justify-end gap-3 pt-4 border-t sticky bottom-0 bg-white">
          <Button
            type="submit"
            disabled={createTransferenciaMutation.isPending || !contextoValido || !canCreateTransferencia}
            className="bg-purple-600 hover:bg-purple-700"
            data-permission="Estoque.Transferencias.criar"
            data-action="Estoque.Transferencias.confirmar"
            data-context-required="group-or-company"
            data-sensitive="true"
          >
            {createTransferenciaMutation.isPending ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Processando...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Confirmar Transferência
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );

  if (windowMode) {
    return <div className="w-full h-full bg-white" data-permission="Estoque.Transferencias.criar" data-context-required="group-or-company">{content}</div>;
  }

  return content;
}
