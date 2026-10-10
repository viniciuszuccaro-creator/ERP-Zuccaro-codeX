import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { FileText, Zap } from "lucide-react";
import { z } from "zod";
import FormWrapper from "@/components/common/FormWrapper";

/**
 * V21.1.2 - WINDOW MODE READY
 */
export default function ContratoForm({ contrato, onSubmit, clientes = [], fornecedores = [], windowMode = false }) {
  const [formData, setFormData] = useState(contrato || {
    numero_contrato: "",
    tipo: "Cliente",
    parte_contratante: "",
    objeto: "",
    descricao: "",
    valor_mensal: 0,
    valor_total: 0,
    data_inicio: "",
    data_fim: "",
    data_assinatura: "",
    vigencia_meses: 12,
    renovacao_automatica: false,
    prazo_aviso_renovacao: 30,
    indice_reajuste: "IGPM",
    percentual_reajuste: 0,
    forma_pagamento: "Boleto",
    dia_vencimento: 10,
    responsavel_empresa: "",
    status: "Rascunho",
    observacoes: "",
    gerar_cobranca_automatica: true
  });

  const schema = z.object({
    numero_contrato: z.string().min(1, 'Número é obrigatório'),
    tipo: z.string().min(1, 'Tipo é obrigatório'),
    parte_contratante: z.string().min(1, 'Parte contratante é obrigatória'),
    data_inicio: z.string().min(4, 'Data início é obrigatória')
  });

  const handleSubmit = async () => {
    onSubmit(formData);
  };

  const content = (
    <FormWrapper schema={schema} defaultValues={formData} onSubmit={handleSubmit} externalData={formData} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="numero_contrato">Número do Contrato *</Label>
          <Input
            id="numero_contrato"
            value={formData.numero_contrato}
            onChange={(e) => setFormData({ ...formData, numero_contrato: e.target.value })}
            placeholder="CONT-2025-001"
            required
          />
        </div>

        <div>
          <Label htmlFor="tipo">Tipo *</Label>
          <Select
            value={formData.tipo}
            onValueChange={(value) => setFormData({ ...formData, tipo: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Cliente">Cliente</SelectItem>
              <SelectItem value="Fornecedor">Fornecedor</SelectItem>
              <SelectItem value="Prestação de Serviço">Prestação de Serviço</SelectItem>
              <SelectItem value="Locação">Locação</SelectItem>
              <SelectItem value="Parceria">Parceria</SelectItem>
              <SelectItem value="Outro">Outro</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {contrato?.id ? (
          <div className="col-span-2">
            <Label>ID técnico</Label>
            <Input
              value={String(contrato.id)}
              readOnly
              disabled
              className="bg-slate-50 font-mono text-xs"
              data-action="id-tecnico-contrato-form"
              title="Identificador técnico imutável; distinto do número do contrato"
            />
          </div>
        ) : null}

        <div className="col-span-2">
          <Label htmlFor="parte_contratante">Parte Contratante *</Label>
          <Input
            id="parte_contratante"
            value={formData.parte_contratante}
            onChange={(e) => setFormData({ ...formData, parte_contratante: e.target.value })}
            list="partes-list"
            required
          />
          <datalist id="partes-list">
            {clientes.map(c => <option key={c.id} value={c.nome} />)}
            {fornecedores.map(f => <option key={f.id} value={f.nome} />)}
          </datalist>
        </div>

        <div className="col-span-2">
          <Label htmlFor="objeto">Objeto do Contrato *</Label>
          <Input
            id="objeto"
            value={formData.objeto}
            onChange={(e) => setFormData({ ...formData, objeto: e.target.value })}
            placeholder="Ex: Fornecimento mensal de produtos"
            required
          />
        </div>

        <div className="col-span-2">
          <Label htmlFor="descricao">Descrição</Label>
          <Textarea
            id="descricao"
            value={formData.descricao}
            onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
            rows={3}
          />
        </div>

        <div>
          <Label htmlFor="valor_mensal">Valor Mensal</Label>
          <Input
            id="valor_mensal"
            type="number"
            step="0.01"
            value={formData.valor_mensal}
            onChange={(e) => setFormData({ ...formData, valor_mensal: parseFloat(e.target.value) })}
          />
        </div>

        <div>
          <Label htmlFor="valor_total">Valor Total</Label>
          <Input
            id="valor_total"
            type="number"
            step="0.01"
            value={formData.valor_total}
            onChange={(e) => setFormData({ ...formData, valor_total: parseFloat(e.target.value) })}
          />
        </div>

        <div>
          <Label htmlFor="data_inicio">Data Início *</Label>
          <Input
            id="data_inicio"
            type="date"
            value={formData.data_inicio}
            onChange={(e) => setFormData({ ...formData, data_inicio: e.target.value })}
            required
          />
        </div>

        <div>
          <Label htmlFor="data_fim">Data Fim</Label>
          <Input
            id="data_fim"
            type="date"
            value={formData.data_fim}
            onChange={(e) => setFormData({ ...formData, data_fim: e.target.value })}
          />
        </div>

        <div>
          <Label htmlFor="vigencia_meses">Vigência (meses)</Label>
          <Input
            id="vigencia_meses"
            type="number"
            value={formData.vigencia_meses}
            onChange={(e) => setFormData({ ...formData, vigencia_meses: parseInt(e.target.value) })}
          />
        </div>
        
        <div>
          <Label htmlFor="indice_reajuste">Índice de Reajuste</Label>
          <Select
            value={formData.indice_reajuste}
            onValueChange={(value) => setFormData({ ...formData, indice_reajuste: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="IPCA">IPCA</SelectItem>
              <SelectItem value="IGPM">IGPM</SelectItem>
              <SelectItem value="INPC">INPC</SelectItem>
              <SelectItem value="CDI">CDI</SelectItem>
              <SelectItem value="Fixo">Fixo</SelectItem>
              <SelectItem value="Outro">Outro</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="percentual_reajuste">Reajuste Anual (%)</Label>
          <Input
            id="percentual_reajuste"
            type="number"
            step="0.01"
            value={formData.percentual_reajuste}
            onChange={(e) => setFormData({ ...formData, percentual_reajuste: parseFloat(e.target.value) })}
          />
        </div>

        <div>
          <Label htmlFor="forma_pagamento">Forma de Pagamento</Label>
          <Select
            value={formData.forma_pagamento}
            onValueChange={(value) => setFormData({ ...formData, forma_pagamento: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Boleto">Boleto</SelectItem>
              <SelectItem value="Transferência">Transferência</SelectItem>
              <SelectItem value="Cartão">Cartão</SelectItem>
              <SelectItem value="PIX">PIX</SelectItem>
              <SelectItem value="Cheque">Cheque</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="dia_vencimento">Dia Vencimento</Label>
          <Input
            id="dia_vencimento"
            type="number"
            min="1"
            max="31"
            value={formData.dia_vencimento}
            onChange={(e) => setFormData({ ...formData, dia_vencimento: parseInt(e.target.value) })}
          />
        </div>

        <div>
          <Label htmlFor="data_assinatura">Data Assinatura</Label>
          <Input
            id="data_assinatura"
            type="date"
            value={formData.data_assinatura}
            onChange={(e) => setFormData({ ...formData, data_assinatura: e.target.value })}
          />
        </div>

        <div>
          <Label htmlFor="responsavel_empresa">Responsável da Empresa</Label>
          <Input
            id="responsavel_empresa"
            value={formData.responsavel_empresa}
            onChange={(e) => setFormData({ ...formData, responsavel_empresa: e.target.value })}
          />
        </div>

        <div>
          <Label htmlFor="status">Status</Label>
          <Select
            value={formData.status}
            onValueChange={(value) => setFormData({ ...formData, status: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Rascunho">Rascunho</SelectItem>
              <SelectItem value="Aguardando Assinatura">Aguardando Assinatura</SelectItem>
              <SelectItem value="Vigente">Vigente</SelectItem>
              <SelectItem value="Vencido">Vencido</SelectItem>
              <SelectItem value="Rescindido">Rescindido</SelectItem>
              <SelectItem value="Renovado">Renovado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="col-span-2 space-y-3 border-t pt-4">
          <h4 className="font-semibold flex items-center gap-2">
            <Zap className="w-4 h-4 text-yellow-600" />
            Automações
          </h4>
          
          <div className="flex items-center space-x-2">
            <Checkbox
              id="renovacao_automatica"
              checked={formData.renovacao_automatica}
              onCheckedChange={(checked) => setFormData({ ...formData, renovacao_automatica: checked })}
            />
            <Label htmlFor="renovacao_automatica" className="font-normal cursor-pointer">
              Renovação automática ao vencer
            </Label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="gerar_cobranca_automatica"
              checked={formData.gerar_cobranca_automatica}
              onCheckedChange={(checked) => setFormData({ ...formData, gerar_cobranca_automatica: checked })}
            />
            <Label htmlFor="gerar_cobranca_automatica" className="font-normal cursor-pointer">
              Gerar boletos/cobranças automaticamente
            </Label>
          </div>

          <div>
            <Label htmlFor="prazo_aviso_renovacao">Alertar renovação com (dias de antecedência)</Label>
            <Input
              id="prazo_aviso_renovacao"
              type="number"
              value={formData.prazo_aviso_renovacao}
              onChange={(e) => setFormData({ ...formData, prazo_aviso_renovacao: parseInt(e.target.value) })}
            />
          </div>
        </div>

        <div className="col-span-2">
          <Label htmlFor="observacoes">Observações</Label>
          <Textarea
            id="observacoes"
            value={formData.observacoes}
            onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
            rows={2}
          />
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
          {contrato ? 'Atualizar' : 'Criar Contrato'}
        </Button>
      </div>
    </FormWrapper>
  );

  if (windowMode) {
    return (
      <div className="w-full h-full overflow-auto bg-white p-6">
        <div className="mb-4 pb-4 border-b">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            {contrato ? 'Editar Contrato' : 'Novo Contrato'}
          </h2>
        </div>
        {content}
      </div>
    );
  }

  return content;
}