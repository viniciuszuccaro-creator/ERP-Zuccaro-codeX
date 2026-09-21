import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const panel=fs.readFileSync(new URL('../src/components/comercial/PedidoCanonicoPanel.jsx',import.meta.url),'utf8');const tab=fs.readFileSync(new URL('../src/components/comercial/PedidosTab.jsx',import.meta.url),'utf8');const comercial=fs.readFileSync(new URL('../src/pages/Comercial.jsx',import.meta.url),'utf8');const quote=fs.readFileSync(new URL('../src/components/comercial/OrcamentosTab.jsx',import.meta.url),'utf8');
test('PedidosTab integra painel HTTP preservando operacao legada',()=>{assert.match(tab,/PedidoCanonicoPanel/);assert.match(tab,/PedidosOperacaoLegada/);assert.match(comercial,/canonicalHttp: true/);assert.doesNotMatch(panel,/base44\.entities|createInContext|updateInContext/);});
test('painel Pedido cobre filtros formulario historico estados e contexto',()=>{for(const marker of ['pedidos-http','cliente_empresa_id','data_entrega_solicitada','requer_producao','Histórico','nextPedidoStatus','Comercial.pedido.visualizar'])assert.match(panel,new RegExp(marker));assert.match(quote,/convertOrcamento/);assert.match(quote,/O orçamento original será preservado/);});
