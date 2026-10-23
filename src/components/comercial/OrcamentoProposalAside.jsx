import { formatCentral360Money as money } from './centralCliente360Money';
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

// Composição visual do editor existente. O rascunho continua no OrcamentosTab.
export default function OrcamentoProposalAside({ cliente, itens, totals, condicao, tabela }) {
  const [panel,setPanel] = useState('cliente');
  const tabs = [['cliente','Cliente e histórico'],['produtos','Produtos e disponibilidade'],['resumo','Resumo e pagamento']];
  return <aside className="rounded-xl border border-sky-200 bg-sky-50 p-4 space-y-4 min-w-0" aria-label="Contexto da proposta sintética">
    <Badge variant="outline" className="bg-white text-sky-900">DEMONSTRAÇÃO SINTÉTICA</Badge>
    <nav className="flex flex-wrap gap-2" aria-label="Painéis da proposta">
      {tabs.map(([key,label]) => <Button key={key} type="button" variant="outline" className={panel === key ? 'bg-sky-700 text-white hover:bg-sky-800 hover:text-white':'bg-white text-slate-800'} aria-pressed={panel === key} onClick={() => setPanel(key)}>{label}</Button>)}
    </nav>
    {panel === 'cliente' && <section className="space-y-3" aria-label="Cliente e histórico sintéticos">
      <h3 className="font-semibold text-sky-950">{cliente || 'Selecione o cliente ao lado'}</h3>
      <div className="rounded-lg bg-white border p-3"><h4 className="font-medium">Histórico ilustrativo</h4>
        <p className="text-sm text-slate-600">Exemplo visual de atendimento anterior. Nenhum pedido, título ou registro foi recuperado.</p>
      </div>
      <p className="text-xs text-slate-600">O cliente e os itens do rascunho permanecem ao alternar os painéis.</p>
    </section>}
    {panel === 'produtos' && <section className="space-y-3" aria-label="Disponibilidade ilustrativa">
      <h3 className="font-semibold text-sky-950">Produtos do rascunho</h3>
      {itens.filter(item=>item.produto_id).map((item,index)=><div key={index} className="rounded-lg bg-white border p-3">
        <p className="font-medium">{item.descricao}</p><p className="text-sm">Preço ilustrativo: {money(item.preco_unitario)} / {item.unidade_sigla}</p>
        <p className="text-sm text-sky-800">Disponibilidade ilustrativa: 30 UN</p>
        <p className="text-xs text-slate-500">Sem consulta ou reserva de estoque real.</p>
      </div>)}
      {!itens.some(item=>item.produto_id) && <p>Selecione um produto no editor.</p>}
    </section>}
    {panel === 'resumo' && <section className="space-y-3" aria-label="Resumo sintético">
      <h3 className="font-semibold text-sky-950">Resumo do rascunho</h3>
      <dl className="grid grid-cols-2 gap-2 text-sm"><dt>Subtotal</dt><dd>{money(totals.subtotal)}</dd><dt>Desconto</dt><dd>{money(totals.desconto)}</dd><dt>Total ilustrativo</dt><dd className="font-bold">{money(totals.total)}</dd></dl>
      <p className="text-sm">Condição: {condicao || 'Selecione no editor'}</p>
      <p className="text-sm">Tabela: {tabela || 'Não informada'}</p>
      <p className="text-xs text-slate-600">Pagamento, gravação, conversão e cobrança estão desabilitados nesta proposta visual.</p>
    </section>}
  </aside>;
}
