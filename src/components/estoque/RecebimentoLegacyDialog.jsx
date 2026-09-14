import React from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

/**
 * @typedef {Record<string, unknown> & {
 *   produto_id: string,
 *   produto_descricao: string,
 *   quantidade_pedida: number,
 *   quantidade_recebida: number,
 *   status_item: string,
 * }} RecebimentoItem
 * @typedef {Record<string, unknown> & {
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
 *   numero_oc?: string,
 *   fornecedor_nome?: string,
 *   status?: string,
 *   itens?: Array<Record<string, unknown> & { descricao?: string, quantidade?: number }>,
 * }} OrdemCompraRecord
 * @typedef {Record<string, unknown> & { id: string, codigo?: string, descricao?: string, status?: string }} ProdutoRecord
 * @typedef {{
 *   formData: RecebimentoFormData,
 *   setFormData: import('react').Dispatch<import('react').SetStateAction<RecebimentoFormData>>,
 *   ordensCompra: OrdemCompraRecord[],
 *   produtos: ProdutoRecord[],
 *   isPending: boolean,
 *   onSubmit: (event: import('react').FormEvent<HTMLFormElement>) => void,
 * }} RecebimentoLegacyDialogProps
 */

const emptyItem = () => /** @type {RecebimentoItem} */ ({
  produto_id: "",
  produto_descricao: "",
  quantidade_pedida: 0,
  quantidade_recebida: 0,
  status_item: "Conforme",
});

/** @param {RecebimentoLegacyDialogProps} props */
export default function RecebimentoLegacyDialog({
  formData,
  setFormData,
  ordensCompra,
  produtos,
  isPending,
  onSubmit,
}) {
  /** @param {string} ocId */
  const handleOrdemCompraChange = (ocId) => {
    const oc = ordensCompra.find((item) => item.id === ocId);
    if (!oc) return;
    setFormData({
      ...formData,
      ordem_compra_id: ocId,
      fornecedor: oc.fornecedor_nome || "",
      itens: oc.itens?.map((item) => ({
        produto_id: "",
        produto_descricao: String(item.descricao || ""),
        quantidade_pedida: Number(item.quantidade || 0),
        quantidade_recebida: Number(item.quantidade || 0),
        status_item: "Conforme",
      })) || [],
    });
  };

  const handleAddItem = () => {
    setFormData({ ...formData, itens: [...formData.itens, emptyItem()] });
  };

  /** @param {number} index */
  const handleRemoveItem = (index) => {
    setFormData({ ...formData, itens: formData.itens.filter((_, itemIndex) => itemIndex !== index) });
  };

  /**
   * @param {number} index
   * @param {keyof RecebimentoItem} field
   * @param {string | number} value
   */
  const handleItemChange = (index, field, value) => {
    const itens = formData.itens.map((item, itemIndex) => (
      itemIndex === index ? { ...item, [field]: value } : item
    ));
    if (field === "produto_id") {
      const produto = produtos.find((item) => item.id === value);
      if (produto) itens[index].produto_descricao = String(produto.descricao || "");
    }
    setFormData({ ...formData, itens });
  };

  return (
    <Dialog open={false}>
      <DialogTrigger asChild>
        <Button
          className="hidden"
          data-permission="Estoque.Recebimento.criar"
          data-action="Estoque.Recebimento.dialogLegado"
          data-context-required="group-or-company"
        >
          Removido
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto hidden">
        <DialogHeader>
          <DialogTitle>Registrar Recebimento de Produtos</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={onSubmit}
          className="space-y-6"
          data-permission="Estoque.Recebimento.criar"
          data-action="Estoque.Recebimento.formularioLegado"
          data-context-required="group-or-company"
        >
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="numero_recebimento">Nº Recebimento</Label>
              <Input
                id="numero_recebimento"
                value={formData.numero_recebimento}
                onChange={(event) => setFormData({ ...formData, numero_recebimento: event.target.value })}
                data-permission="Estoque.Recebimento.criar"
                data-action="Estoque.Recebimento.numero"
                data-context-required="group-or-company"
              />
            </div>

            <div>
              <Label htmlFor="data_recebimento">Data Recebimento</Label>
              <Input
                id="data_recebimento"
                type="date"
                value={formData.data_recebimento}
                onChange={(event) => setFormData({ ...formData, data_recebimento: event.target.value })}
                data-permission="Estoque.Recebimento.criar"
                data-action="Estoque.Recebimento.data"
                data-context-required="group-or-company"
              />
            </div>

            <div>
              <Label htmlFor="ordem_compra">Ordem de Compra (opcional)</Label>
              <Select value={formData.ordem_compra_id} onValueChange={handleOrdemCompraChange}>
                <SelectTrigger
                  data-permission="Estoque.Recebimento.criar"
                  data-action="Estoque.Recebimento.ordemCompra"
                  data-context-required="group-or-company"
                >
                  <SelectValue placeholder="Selecione uma OC" />
                </SelectTrigger>
                <SelectContent>
                  {ordensCompra.filter((item) => item.status === "Enviada" || item.status === "Em Processo").map((oc) => (
                    <SelectItem key={oc.id} value={oc.id}>
                      {oc.numero_oc} - {oc.fornecedor_nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="fornecedor">Fornecedor</Label>
              <Input
                id="fornecedor"
                value={formData.fornecedor}
                onChange={(event) => setFormData({ ...formData, fornecedor: event.target.value })}
                data-permission="Estoque.Recebimento.criar"
                data-action="Estoque.Recebimento.fornecedor"
                data-context-required="group-or-company"
              />
            </div>

            <div>
              <Label htmlFor="numero_nf">Nº Nota Fiscal</Label>
              <Input
                id="numero_nf"
                value={formData.numero_nf}
                onChange={(event) => setFormData({ ...formData, numero_nf: event.target.value })}
                data-permission="Estoque.Recebimento.criar"
                data-action="Estoque.Recebimento.notaFiscal"
                data-context-required="group-or-company"
              />
            </div>

            <div>
              <Label htmlFor="responsavel_recebimento">Responsável</Label>
              <Input
                id="responsavel_recebimento"
                value={formData.responsavel_recebimento}
                onChange={(event) => setFormData({ ...formData, responsavel_recebimento: event.target.value })}
                data-permission="Estoque.Recebimento.criar"
                data-action="Estoque.Recebimento.responsavel"
                data-context-required="group-or-company"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <Label>Itens do Recebimento</Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleAddItem}
                data-permission="Estoque.Recebimento.criar"
                data-action="Estoque.Recebimento.adicionarItem"
                data-context-required="group-or-company"
              >
                <Plus className="w-4 h-4 mr-1" /> Adicionar Item
              </Button>
            </div>

            <div className="space-y-3">
              {formData.itens.map((item, index) => (
                <div key={index} className="grid grid-cols-12 gap-2 p-3 border rounded-lg">
                  <div className="col-span-4">
                    <Select value={item.produto_id} onValueChange={(value) => handleItemChange(index, "produto_id", value)}>
                      <SelectTrigger
                        data-permission="Estoque.Recebimento.criar"
                        data-action="Estoque.Recebimento.itemProduto"
                        data-context-required="group-or-company"
                      >
                        <SelectValue placeholder="Selecione produto" />
                      </SelectTrigger>
                      <SelectContent>
                        {produtos.filter((produto) => produto.status === "Ativo").map((produto) => (
                          <SelectItem key={produto.id} value={produto.id}>
                            {produto.codigo ? `${produto.codigo} - ` : ""}{produto.descricao}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2">
                    <Input
                      type="number"
                      placeholder="Qtd Pedida"
                      value={item.quantidade_pedida}
                      onChange={(event) => handleItemChange(index, "quantidade_pedida", parseFloat(event.target.value) || 0)}
                      data-permission="Estoque.Recebimento.criar"
                      data-action="Estoque.Recebimento.quantidadePedida"
                      data-context-required="group-or-company"
                      data-sensitive="true"
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      type="number"
                      placeholder="Qtd Recebida"
                      value={item.quantidade_recebida}
                      onChange={(event) => handleItemChange(index, "quantidade_recebida", parseFloat(event.target.value) || 0)}
                      data-permission="Estoque.Recebimento.criar"
                      data-action="Estoque.Recebimento.quantidadeRecebida"
                      data-context-required="group-or-company"
                      data-sensitive="true"
                    />
                  </div>
                  <div className="col-span-3">
                    <Select value={item.status_item} onValueChange={(value) => handleItemChange(index, "status_item", value)}>
                      <SelectTrigger
                        data-permission="Estoque.Recebimento.criar"
                        data-action="Estoque.Recebimento.statusItem"
                        data-context-required="group-or-company"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Conforme">Conforme</SelectItem>
                        <SelectItem value="Divergente">Divergente</SelectItem>
                        <SelectItem value="Avariado">Avariado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-1 flex items-center">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => handleRemoveItem(index)}
                      disabled={formData.itens.length === 1}
                      data-permission="Estoque.Recebimento.criar"
                      data-action="Estoque.Recebimento.removerItem"
                      data-context-required="group-or-company"
                    >
                      ×
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea
              id="observacoes"
              value={formData.observacoes}
              onChange={(event) => setFormData({ ...formData, observacoes: event.target.value })}
              rows={3}
              data-permission="Estoque.Recebimento.criar"
              data-action="Estoque.Recebimento.observacoes"
              data-context-required="group-or-company"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="submit"
              disabled={isPending}
              className="bg-green-600 hover:bg-green-700"
              data-permission="Estoque.Recebimento.criar"
              data-action="Estoque.Recebimento.confirmar"
              data-context-required="group-or-company"
              data-sensitive="true"
            >
              {isPending ? "Salvando..." : "Registrar Recebimento"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
