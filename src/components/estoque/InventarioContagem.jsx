import React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Trash2, Plus } from 'lucide-react';

const toNumber = (value) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const sanitizeText = (value) => String(value ?? '').replace(/[<>]/g, '').slice(0, 180);

const calcularAjuste = (item) => toNumber(item.contagem) - toNumber(item.saldo_sistema);

export default function InventarioContagem({ itens = [], onChange, disabled = false }) {
  const emitirAlteracao = (proximosItens) => {
    if (!disabled) onChange?.(proximosItens);
  };

  const atualizar = (idx, patch) => {
    if (disabled) return;
    const novo = itens.map((it, i) => {
      if (i !== idx) return it;
      const atualizado = { ...it, ...patch };
      return { ...atualizado, ajuste: calcularAjuste(atualizado) };
    });
    emitirAlteracao(novo);
  };

  const adicionar = () => {
    emitirAlteracao([
      ...itens,
      { produto_id: '', produto_descricao: '', unidade: 'UN', saldo_sistema: 0, contagem: 0, ajuste: 0 },
    ]);
  };

  const remover = (idx) => {
    if (disabled) return;
    const item = itens[idx];
    const descricao = item?.produto_descricao || 'item ' + (idx + 1);
    const confirmado = window.confirm('Remover ' + descricao + ' da contagem do inventário? A alteração só será persistida ao salvar o inventário.');
    if (!confirmado) return;
    emitirAlteracao(itens.filter((_, i) => i !== idx));
  };

  return (
    <div
      className="w-full h-full space-y-3"
      data-permission="Estoque.Inventario.Contagem"
      data-context-required="group-or-company"
    >
      <div className="flex flex-wrap justify-between items-center gap-2">
        <h4 className="font-semibold">Itens do Inventário</h4>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled}
          onClick={adicionar}
          data-action="Estoque.Inventario.Contagem.adicionar"
          data-permission="Estoque.Inventario.editar"
          data-context-required="group-or-company"
        >
          <Plus className="w-3 h-3 mr-1" />Adicionar
        </Button>
      </div>

      <div className="w-full overflow-x-auto rounded-md border bg-white">
        <div className="min-w-[760px]">
          <div className="grid grid-cols-12 gap-2 px-3 py-2 text-xs font-medium text-slate-500 bg-slate-50 border-b">
            <div className="col-span-4">Produto (descrição)</div>
            <div>Unid</div>
            <div className="col-span-2">Saldo Sist.</div>
            <div className="col-span-2">Contagem</div>
            <div className="col-span-2">Ajuste</div>
            <div></div>
          </div>

          {itens.length === 0 && (
            <div className="px-3 py-6 text-sm text-slate-500 text-center">
              Nenhum item informado para esta contagem.
            </div>
          )}

          {itens.map((it, idx) => {
            const ajuste = calcularAjuste(it);
            return (
              <div key={idx} className="grid grid-cols-12 gap-2 items-center px-3 py-2 border-b last:border-b-0">
                <Input
                  className="col-span-4"
                  value={it.produto_descricao || ''}
                  disabled={disabled}
                  onChange={(e) => atualizar(idx, { produto_descricao: sanitizeText(e.target.value) })}
                  placeholder="Descrição do produto"
                  aria-label="Descrição do produto"
                  data-action="Estoque.Inventario.Contagem.produtoDescricao"
                  data-permission="Estoque.Inventario.editar"
                  data-context-required="group-or-company"
                />
                <Input
                  className="col-span-1"
                  value={it.unidade || 'UN'}
                  disabled={disabled}
                  onChange={(e) => atualizar(idx, { unidade: sanitizeText(e.target.value).toUpperCase().slice(0, 6) })}
                  aria-label="Unidade"
                  data-action="Estoque.Inventario.Contagem.unidade"
                  data-permission="Estoque.Inventario.editar"
                  data-context-required="group-or-company"
                />
                <Input
                  className="col-span-2"
                  type="number"
                  value={toNumber(it.saldo_sistema)}
                  disabled={disabled}
                  onChange={(e) => atualizar(idx, { saldo_sistema: toNumber(e.target.value) })}
                  aria-label="Saldo do sistema"
                  data-action="Estoque.Inventario.Contagem.saldoSistema"
                  data-permission="Estoque.Inventario.editar"
                  data-context-required="group-or-company"
                />
                <Input
                  className="col-span-2"
                  type="number"
                  value={toNumber(it.contagem)}
                  disabled={disabled}
                  onChange={(e) => atualizar(idx, { contagem: toNumber(e.target.value) })}
                  aria-label="Contagem física"
                  data-action="Estoque.Inventario.Contagem.contagemFisica"
                  data-permission="Estoque.Inventario.editar"
                  data-context-required="group-or-company"
                />
                <Input
                  className="col-span-2"
                  type="number"
                  value={ajuste}
                  readOnly
                  aria-label="Ajuste calculado"
                  data-action="Estoque.Inventario.Contagem.ajusteCalculado"
                  data-permission="Estoque.Inventario.visualizar"
                  data-context-required="group-or-company"
                />
                <div className="col-span-1 flex justify-end">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    disabled={disabled}
                    onClick={() => remover(idx)}
                    aria-label="Remover item da contagem"
                    data-action="Estoque.Inventario.Contagem.remover"
                    data-permission="Estoque.Inventario.editar"
                    data-context-required="group-or-company"
                    data-sensitive="true"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
