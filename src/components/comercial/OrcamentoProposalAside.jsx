import { formatCentral360Money as money } from './centralCliente360Money';
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const TABS = [
  ['cliente', 'Cliente e histórico'],
  ['produtos', 'Produtos e preços'],
  ['resumo', 'Resumo e pagamento'],
  ['acoes', 'Ações próximas'],
];

/** Composição visual do editor existente. O rascunho continua no OrcamentosTab. */
export default function OrcamentoProposalAside({
  cliente,
  clienteCodigo,
  clienteIdTecnico,
  itens,
  totals,
  condicao,
  tabela,
  historicoIlustrativo = [],
  formasPagamentoIlustrativas = [],
}) {
  const [panel, setPanel] = useState('cliente');
  const itensComProduto = itens.filter((item) => item.produto_id);

  return (
    <aside
      className="rounded-xl border border-sky-200 bg-gradient-to-b from-sky-50 to-white p-3 sm:p-4 space-y-3 min-w-0 w-full xl:max-w-sm"
      aria-label="Contexto da proposta sintética"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="bg-white text-sky-900 border-sky-300">
          DEMONSTRAÇÃO SINTÉTICA
        </Badge>
        <p className="text-xs text-slate-600">Rascunho preservado ao trocar painéis.</p>
      </div>
      <nav className="flex flex-wrap gap-2" aria-label="Painéis da proposta">
        {TABS.map(([key, label]) => (
          <Button
            key={key}
            type="button"
            size="sm"
            variant="outline"
            className={
              panel === key
                ? 'bg-sky-700 text-white hover:bg-sky-800 hover:text-white border-sky-700'
                : 'bg-white text-slate-800 border-sky-200'
            }
            aria-pressed={panel === key}
            data-action={`proposta-painel-${key}`}
            onClick={() => setPanel(key)}
          >
            {label}
          </Button>
        ))}
      </nav>

      {panel === 'cliente' && (
        <section className="space-y-3" aria-label="Cliente e histórico sintéticos">
          <h3 className="font-semibold text-sky-950">{cliente || 'Selecione o cliente ao lado'}</h3>
          {(clienteCodigo || clienteIdTecnico) && (
            <dl className="grid grid-cols-1 gap-1 text-xs text-slate-700 bg-white border border-sky-100 rounded-lg p-3">
              <div className="flex justify-between gap-2">
                <dt>Código numérico</dt>
                <dd className="font-mono">{clienteCodigo || '—'}</dd>
              </div>
              <div className="flex justify-between gap-2 min-w-0">
                <dt>ID técnico</dt>
                <dd className="font-mono truncate" title={clienteIdTecnico || undefined}>
                  {clienteIdTecnico || '—'}
                </dd>
              </div>
            </dl>
          )}
          <div className="rounded-lg bg-white border border-sky-100 p-3 space-y-2">
            <h4 className="font-medium text-sm">Histórico ilustrativo</h4>
            {historicoIlustrativo.length === 0 ? (
              <p className="text-sm text-slate-600">
                Exemplo visual de atendimento. Nenhum pedido, título ou registro foi recuperado.
              </p>
            ) : (
              <ul className="space-y-2">
                {historicoIlustrativo.map((entry) => (
                  <li key={entry.id} className="text-sm border-b border-slate-100 pb-2 last:border-0">
                    <p className="font-medium text-slate-800">{entry.titulo}</p>
                    <p className="text-xs text-slate-500">
                      {entry.data} · {entry.status}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      {panel === 'produtos' && (
        <section className="space-y-3" aria-label="Produtos preços e disponibilidade ilustrativos">
          <h3 className="font-semibold text-sky-950">Produtos do rascunho</h3>
          {itensComProduto.map((item, index) => (
            <div key={`${item.produto_id}-${index}`} className="rounded-lg bg-white border border-sky-100 p-3 space-y-1">
              <p className="font-medium">{item.descricao}</p>
              <p className="text-xs font-mono text-slate-600">
                Código {item.produto_codigo || '—'} · ID {item.produto_id}
              </p>
              <p className="text-sm">
                Preço ilustrativo: {money(item.preco_unitario)} / {item.unidade_sigla || '—'}
              </p>
              <p className="text-sm text-sky-800">Disponibilidade ilustrativa: 30 {item.unidade_sigla || 'UN'}</p>
              <p className="text-xs text-slate-500">Sem consulta ou reserva de estoque real.</p>
            </div>
          ))}
          {itensComProduto.length === 0 && <p className="text-sm text-slate-600">Selecione um produto no editor.</p>}
        </section>
      )}

      {panel === 'resumo' && (
        <section className="space-y-3" aria-label="Resumo e pagamento sintéticos">
          <h3 className="font-semibold text-sky-950">Resumo do rascunho</h3>
          <dl className="grid grid-cols-2 gap-2 text-sm bg-white border border-sky-100 rounded-lg p-3">
            <dt>Subtotal</dt>
            <dd className="text-right">{money(totals.subtotal)}</dd>
            <dt>Desconto</dt>
            <dd className="text-right">{money(totals.desconto)}</dd>
            <dt>Total ilustrativo</dt>
            <dd className="text-right font-bold">{money(totals.total)}</dd>
          </dl>
          <p className="text-sm">Condição: {condicao || 'Selecione no editor'}</p>
          <p className="text-sm">Tabela: {tabela || 'Não informada'}</p>
          <div className="rounded-lg bg-white border border-sky-100 p-3 space-y-2">
            <h4 className="font-medium text-sm">Pagamento ilustrativo</h4>
            {formasPagamentoIlustrativas.length === 0 ? (
              <p className="text-xs text-slate-600">Formas de pagamento reais permanecem no fluxo operacional.</p>
            ) : (
              <ul className="text-sm space-y-1">
                {formasPagamentoIlustrativas.map((forma) => (
                  <li key={forma.id} className="flex justify-between gap-2">
                    <span>{forma.nome}</span>
                    <span className="text-xs text-slate-500">{forma.codigo}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-xs text-slate-600">Cobrança e liquidação desabilitadas nesta proposta visual.</p>
          </div>
        </section>
      )}

      {panel === 'acoes' && (
        <section className="space-y-3" aria-label="Ações próximas desabilitadas">
          <h3 className="font-semibold text-sky-950">Ações próximas</h3>
          <p className="text-xs text-slate-600">
            Botões visíveis apenas para layout. Operações reais seguem Orçamento/Pedido canônicos após aprovação visual.
          </p>
          <div className="flex flex-col gap-2">
            {[
              ['Salvar orçamento', 'Gravação bloqueada na prévia sintética'],
              ['Converter em pedido', 'Conversão canônica desabilitada na prévia'],
              ['Reservar estoque', 'Sem reserva real nesta demonstração'],
              ['Enviar WhatsApp', 'Compartilhamento operacional fora da prévia'],
            ].map(([label, reason]) => (
              <Button
                key={label}
                type="button"
                variant="outline"
                disabled
                className="justify-start border-sky-200 bg-white text-slate-700"
                title={reason}
                data-action={`proposta-acao-${label}`}
              >
                {label}
              </Button>
            ))}
          </div>
        </section>
      )}
    </aside>
  );
}
