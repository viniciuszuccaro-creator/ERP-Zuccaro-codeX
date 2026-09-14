import React from 'react';
import { AlertCircle, Save } from 'lucide-react';

import ProtectedField from '@/components/security/ProtectedField';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

/** @typedef {import('@/components/lib/estoqueMovimentoPolicy').TransferFormState} TransferFormState */
/** @typedef {import('@/components/lib/estoqueMovimentoPolicy').TransferCompanyRecord} TransferCompanyRecord */
/** @typedef {import('@/components/lib/estoqueMovimentoPolicy').TransferProductRecord} TransferProductRecord */

/**
 * Campos privados do formulario existente, sem persistencia propria.
 * @param {{
 *   formData: TransferFormState,
 *   setFormData: React.Dispatch<React.SetStateAction<TransferFormState>>,
 *   companies: TransferCompanyRecord[],
 *   products: TransferProductRecord[],
 *   selectedProduct?: TransferProductRecord,
 *   disabled: boolean,
 *   isPending: boolean,
 * }} props
 */
export default function TransferenciaEntreEmpresasFields({
  formData,
  setFormData,
  companies,
  products,
  selectedProduct,
  disabled,
  isPending,
}) {
  const update = (/** @type {Partial<TransferFormState>} */ patch) => setFormData((current) => ({ ...current, ...patch }));

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>Empresa Origem *</Label>
          <Select value={formData.empresa_origem_id} onValueChange={(value) => update({ empresa_origem_id: value })} disabled={disabled}>
            <SelectTrigger data-permission="Estoque.Transferencias.criar" data-action="Estoque.Transferencias.empresaOrigem" data-context-required="group-and-companies">
              <SelectValue placeholder="Selecione..." />
            </SelectTrigger>
            <SelectContent>
              {companies.map((empresa) => (
                <SelectItem key={empresa.id} value={String(empresa.id)}>
                  {String(empresa.nome_fantasia || empresa.razao_social || 'Empresa')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Empresa Destino *</Label>
          <Select value={formData.empresa_destino_id} onValueChange={(value) => update({ empresa_destino_id: value })} disabled={disabled}>
            <SelectTrigger data-permission="Estoque.Transferencias.criar" data-action="Estoque.Transferencias.empresaDestino" data-context-required="group-and-companies">
              <SelectValue placeholder="Selecione..." />
            </SelectTrigger>
            <SelectContent>
              {companies.map((empresa) => (
                <SelectItem key={empresa.id} value={String(empresa.id)}>
                  {String(empresa.nome_fantasia || empresa.razao_social || 'Empresa')}
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
          onValueChange={(value) => {
            const product = products.find((item) => item.id === value);
            update({ produto_id: value, unidade: String(product?.unidade_medida || '') });
          }}
          disabled={disabled}
        >
          <SelectTrigger data-permission="Estoque.Transferencias.criar" data-action="Estoque.Transferencias.produto" data-context-required="group-and-companies">
            <SelectValue placeholder="Selecione..." />
          </SelectTrigger>
          <SelectContent>
            {products.filter((product) => String(product.status || 'Ativo') === 'Ativo').map((product) => (
              <SelectItem key={product.id} value={String(product.id)}>
                {product.codigo ? `${String(product.codigo)} - ` : ''}{String(product.descricao || 'Produto')}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedProduct && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-blue-700">Estoque Atual</p>
                <p className="font-bold text-blue-900">
                  {Number(selectedProduct.estoque_atual || 0)} {String(selectedProduct.unidade_medida || '')}
                </p>
              </div>
              <div>
                <p className="text-blue-700">Custo Médio</p>
                <p className="font-bold text-blue-900">
                  <ProtectedField module="Estoque" submodule="Transferencias" tab={undefined} field="custo" action="ver" asText>
                    R$ {Number(selectedProduct.custo_medio || selectedProduct.custo_aquisicao || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </ProtectedField>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label>Quantidade *</Label>
          <Input
            type="number"
            min="0.001"
            step="0.001"
            value={formData.quantidade}
            onChange={(event) => update({ quantidade: Number.parseFloat(event.target.value) || 0 })}
            disabled={disabled}
            data-permission="Estoque.Transferencias.criar"
            data-action="Estoque.Transferencias.quantidade"
            data-context-required="group-and-companies"
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
            data-context-required="group-and-companies"
          />
        </div>
      </div>

      <div>
        <Label>Motivo *</Label>
        <Select value={formData.motivo} onValueChange={(value) => update({ motivo: value })} disabled={disabled}>
          <SelectTrigger data-permission="Estoque.Transferencias.criar" data-action="Estoque.Transferencias.motivo" data-context-required="group-and-companies">
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
              onChange={(event) => update({ gerar_financeiro: event.target.checked })}
              disabled={disabled}
              className="w-4 h-4"
              data-permission="Estoque.Transferencias.criar"
              data-action="Estoque.Transferencias.gerarFinanceiroInterno"
              data-context-required="group-and-companies"
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
          onChange={(event) => update({ observacoes: event.target.value })}
          rows={3}
          maxLength={500}
          disabled={disabled}
          data-permission="Estoque.Transferencias.criar"
          data-action="Estoque.Transferencias.observacoes"
          data-context-required="group-and-companies"
        />
      </div>

      {formData.empresa_origem_id === formData.empresa_destino_id && formData.empresa_origem_id && (
        <Card className="border-red-300 bg-red-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <p className="text-sm text-red-700"><strong>Erro:</strong> Empresa origem e destino não podem ser iguais</p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end gap-3 pt-4 border-t sticky bottom-0 bg-white">
        <Button
          type="submit"
          disabled={isPending || disabled}
          className="bg-purple-600 hover:bg-purple-700"
          data-permission="Estoque.Transferencias.criar"
          data-action="Estoque.Transferencias.confirmar"
          data-context-required="group-and-companies"
          data-sensitive="true"
        >
          {isPending ? (
            <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />Processando...</>
          ) : (
            <><Save className="w-4 h-4 mr-2" />Confirmar Transferência</>
          )}
        </Button>
      </div>
    </>
  );
}
