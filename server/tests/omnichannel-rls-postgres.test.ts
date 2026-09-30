import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { pedidoHistorico026Preflight } from '../src/db/migrate.js';
import { PostgresPedidoRepository } from '../src/repositories/postgresPedidoRepository.js';
import { outboxFixture } from './omnichannelOutboxFixture.js';
import { isolatedPostgres } from './omnichannelPostgresFixture.js';
import { SEED_IDS as S } from '../scripts/seedDevIds.js';
import { boot, identity } from './omnichannelFixture.js';

const url = process.env.OMNICHANNEL_POSTGRES_URL;

for (const engine of ['PGlite', 'PostgreSQL real']) {
  test(`${engine}: cancelamento entre leitura e update impede escrita e preserva itens`, { skip: engine === 'PostgreSQL real' && !url }, async () => {
    const f=await boot(engine==='PGlite'?new PGlite():await isolatedPostgres(url!));
    try {
      const created=await f.send({...f.envelope,idempotencyKey:randomUUID()},{nonce:randomUUID()});
      assert.equal(created.status,201);
      const id=created.body.data.id;
      const repo=new PostgresPedidoRepository(f.pg as never);
      const scope={groupId:identity.groupId,empresaId:identity.empresaId};
      const before=await repo.get(scope,id);
      assert.ok(before);
      let switched=false;
      const racingExecutor={query:async (sql:string,params?:unknown[])=>{
        const result=await f.pg.query(sql,params);
        if (!switched && sql.includes('SELECT p.*')) {
          switched=true;
          await f.pg.query("UPDATE pedidos SET status='CANCELADO',ativo=false WHERE id=$1",[id]);
        }
        return result;
      }};
      const after=await repo.update(scope,id,{...before,observacoes:'MUTACAO_TARDIA'},identity.actorId,racingExecutor as never,true);
      assert.equal(switched,true);
      assert.equal(after,null);
      const stored=await repo.get(scope,id);
      assert.equal(stored?.status,'CANCELADO');
      assert.equal(stored?.observacoes,before.observacoes);
      assert.deepEqual(stored?.itens.map(item=>item.id),before.itens.map(item=>item.id));
      const second=await f.send({...f.envelope,idempotencyKey:randomUUID()},{nonce:randomUUID()});
      assert.equal(second.status,201);
      const secondId=second.body.data.id;
      const priorHistory=(await repo.history(scope,secondId)).length;
      let statusSwitched=false;
      const statusExecutor={query:async (sql:string,params?:unknown[])=>{
        const result=await f.pg.query(sql,params);
        if (!statusSwitched && sql.includes('SELECT p.*')) {
          statusSwitched=true;
          await f.pg.query("UPDATE pedidos SET status='CANCELADO',ativo=false WHERE id=$1",[secondId]);
        }
        return result;
      }};
      const transition=await repo.changeStatus(scope,secondId,'PRONTO_RETIRADA',identity.actorId,undefined,statusExecutor as never);
      assert.equal(statusSwitched,true);
      assert.equal(transition,null);
      assert.equal((await repo.get(scope,secondId))?.status,'CANCELADO');
      assert.equal((await repo.history(scope,secondId)).length,priorHistory);
    } finally { await f.close(); }
  });

  test(`${engine}: intenção ARMADO/CORTE_DOBRA é persistida no Orçamento e copiada sem inferência viva`, { skip: engine === 'PostgreSQL real' && !url }, async () => {
    const f=await boot(engine==='PGlite'?new PGlite():await isolatedPostgres(url!));
    try {
      await f.pg.query("UPDATE profiles SET permissoes=jsonb_set(jsonb_set(permissoes,'{Comercial,orcamento}', '[\"criar\",\"visualizar\"]'::jsonb),'{Comercial,pedido}', '[\"criar\",\"visualizar\",\"editar\",\"converter-pedido\"]'::jsonb) WHERE id=$1",[identity.actorId]);
      const {tipo_operacao:_operation,data_entrega_solicitada:_delivery,...base}=f.envelope.documento;
      const ctx={groupId:identity.groupId,empresaId:identity.empresaId,actorId:identity.actorId,scopeType:'empresa' as const,requestId:'synthetic-special'};
      for (const tipo of ['ARMADO','CORTE_DOBRA'] as const) {
        const documento={...base,validade_em:'2027-03-01T00:00:00.000Z',itens:base.itens.map(item=>({...item,requer_producao:true,tipo_comercial:tipo}))};
        const invalid=await f.send({...f.envelope,idempotencyKey:randomUUID(),tipo:'Orcamento',documento:{...documento,itens:documento.itens.map(item=>({...item,requer_producao:false}))}},{nonce:randomUUID()});
        assert.equal(invalid.status,422);
        const created=await f.send({...f.envelope,idempotencyKey:randomUUID(),tipo:'Orcamento',documento},{nonce:randomUUID()});
        assert.equal(created.status,201);
        const quote=await f.runtime.orcamentoService.get(ctx,created.body.data.id);
        assert.equal(quote.itens[0]?.tipo_comercial,tipo);
        assert.equal(quote.itens[0]?.requer_producao,true);
        const audit=await f.runtime.auditRepo.listByEntity('Orcamento',quote.id);
        assert.ok(audit.some(event=>(event.afterData as {tipos_especiais_itens?:string[]})?.tipos_especiais_itens?.[0]===tipo));
        const order=await f.runtime.pedidoService.convert(ctx,quote.id,{tipo_operacao:'RETIRADA',data_entrega_solicitada:'2027-03-10T00:00:00.000Z'});
        assert.equal(order.itens[0]?.tipo_comercial_snapshot,tipo);
        assert.equal(order.itens[0]?.requer_producao,true);
        if (tipo==='CORTE_DOBRA') {
          await f.pg.query('UPDATE produtos SET ativo=false,tipo_item=$1 WHERE id=$2',['REVENDA',order.itens[0]!.produto_id]);
          const operational={cliente_empresa_id:order.cliente_empresa_id,condicao_pagamento_id:order.condicao_pagamento_id,
            orcamento_id:quote.id,tipo_operacao:'RETIRADA',data_entrega_solicitada:'2027-03-11T00:00:00.000Z',
            itens:order.itens.map(item=>({produto_id:item.produto_id,unidade_id:item.unidade_id,
              descricao:item.descricao,unidade_sigla:item.unidade_sigla,quantidade:item.quantidade,
              preco_unitario:item.preco_unitario,desconto:item.desconto,requer_producao:item.requer_producao}))};
          const amended=await f.runtime.pedidoService.update(ctx,order.id,operational);
          assert.equal(amended.itens[0]?.id,order.itens[0]?.id);
          assert.equal(amended.itens[0]?.tipo_comercial_snapshot,'CORTE_DOBRA');
          assert.equal(amended.itens[0]?.requer_producao,true);
          assert.ok((await f.runtime.auditRepo.listByEntity('Pedido',order.id)).some(event=>event.action==='update'));
          await f.pg.query('UPDATE produtos SET ativo=true WHERE id=$1',[order.itens[0]!.produto_id]);
        }
      }
      const report=await pedidoHistorico026Preflight(f.pg as never);
      assert.equal(report.porEmpresa.find(row=>row.empresaId===identity.empresaId)?.pedidos,2);
      assert.equal(report.porEmpresa.find(row=>row.empresaId===identity.empresaId)?.itens,2);
      assert.ok(report.reasons.includes('HISTORICAL_CLASSIFICATION_PROVENANCE_REQUIRED'));
      const scoped=await pedidoHistorico026Preflight(f.integrationDb as never);
      assert.equal(scoped.blocked,true);
      assert.equal(scoped.pedidos,0);
      assert.ok(scoped.reasons.includes('UNTRUSTED_RLS_VISIBILITY'));
      const migration=readFileSync(new URL('../migrations/035_orcamento_tipo_especial_snapshot.sql',import.meta.url),'utf8');
      const historical=await f.pg.query<{id:string}>('SELECT id FROM orcamento_itens ORDER BY created_at,id LIMIT 1');
      assert.ok(historical.rows[0]?.id);
      await f.pg.query('UPDATE orcamento_itens SET tipo_comercial=NULL,requer_producao=NULL WHERE id=$1',[historical.rows[0].id]);
      await f.pg.exec(migration);
      await f.pg.exec(migration);
      const unmapped=await f.pg.query<{tipo_comercial:string|null;requer_producao:boolean|null}>('SELECT tipo_comercial,requer_producao FROM orcamento_itens WHERE id=$1',[historical.rows[0].id]);
      assert.equal(unmapped.rows[0]?.tipo_comercial,null);
      assert.equal(unmapped.rows[0]?.requer_producao,null);
    } finally { await f.close(); }
  });

  test(`${engine}: converter v1 impede versionar e segundo Pedido na mesma raiz`, { skip: engine === 'PostgreSQL real' && !url }, async () => {
    const f=await boot(engine==='PGlite'?new PGlite():await isolatedPostgres(url!));
    try {
      await f.pg.query("UPDATE profiles SET permissoes=jsonb_set(jsonb_set(permissoes,'{Comercial,orcamento}', '[\"criar\",\"visualizar\",\"editar\",\"cancelar\",\"versionar\"]'::jsonb),'{Comercial,pedido}', '[\"criar\",\"visualizar\",\"editar\",\"converter-pedido\"]'::jsonb) WHERE id=$1",[identity.actorId]);
      const {tipo_operacao:_operation,data_entrega_solicitada:_delivery,...quote}=f.envelope.documento;
      const created=await f.send({...f.envelope,tipo:'Orcamento',documento:{...quote,validade_em:'2027-03-01T00:00:00.000Z'}});
      assert.equal(created.status,201);
      const ctx={groupId:identity.groupId,empresaId:identity.empresaId,actorId:identity.actorId,scopeType:'empresa' as const,requestId:'synthetic-chain'};
      const source=await f.runtime.orcamentoService.get(ctx,created.body.data.id);
      const order=await f.runtime.pedidoService.convert(ctx,source.id,{tipo_operacao:'RETIRADA',data_entrega_solicitada:'2027-03-10T00:00:00.000Z'});
      const updatePayload={cliente_empresa_id:order.cliente_empresa_id,condicao_pagamento_id:order.condicao_pagamento_id,
        orcamento_id:source.id,tipo_operacao:'RETIRADA' as const,data_entrega_solicitada:'2027-03-11T00:00:00.000Z',
        itens:order.itens.map(item=>({produto_id:item.produto_id,unidade_id:item.unidade_id,
          descricao:item.descricao,unidade_sigla:item.unidade_sigla,quantidade:item.quantidade,
          preco_unitario:item.preco_unitario,desconto:item.desconto,requer_producao:item.requer_producao}))};
      await assert.rejects(()=>f.runtime.pedidoService.update(ctx,order.id,{...updatePayload,
        itens:[{...updatePayload.itens[0],preco_unitario:'1.000000'}]}),(error:any)=>error.statusCode===422);
      await assert.rejects(()=>f.runtime.pedidoService.update(ctx,order.id,{...updatePayload,
        itens:[{...updatePayload.itens[0],quantidade:'999.000000'}]}),(error:any)=>error.statusCode===422);
      await assert.rejects(()=>f.runtime.pedidoService.update(ctx,order.id,{...updatePayload,
        condicao_pagamento_id:randomUUID()}),(error:any)=>error.statusCode===422);
      await assert.rejects(()=>f.runtime.pedidoService.update(ctx,order.id,{...updatePayload,
        promocao:{bps:500}}),(error:any)=>error.statusCode===422);
      await f.pg.query('UPDATE condicoes_pagamento SET nome=$1 WHERE id=$2',['Condicao viva alterada',order.condicao_pagamento_id]);
      await f.pg.query('UPDATE pedidos SET promocao_aplicada=true,promocao_bps=500,promocao_cupom=$1 WHERE id=$2',['SINTETICO',order.id]);
      await f.pg.query('UPDATE pedidos SET cliente_local_id=$1,obra_id=$2 WHERE id=$3',[S.clienteLocalA,S.obraA,order.id]);
      const updated=await f.runtime.pedidoService.update(ctx,order.id,updatePayload);
      assert.equal(updated.itens[0]?.preco_unitario,order.itens[0]?.preco_unitario);
      assert.equal(updated.tabela_preco_codigo_snapshot,order.tabela_preco_codigo_snapshot);
      assert.equal(updated.tabela_preco_nome_snapshot,order.tabela_preco_nome_snapshot);
      assert.equal(updated.condicao_pagamento_nome_snapshot,order.condicao_pagamento_nome_snapshot);
      assert.equal(updated.promocao_aplicada,true);
      assert.equal(updated.promocao_bps,500);
      assert.equal(updated.promocao_cupom,'SINTETICO');
      assert.equal(updated.cliente_local_id,S.clienteLocalA);
      assert.equal(updated.obra_id,S.obraA);
      const versionPayload={cliente_empresa_id:source.cliente_empresa_id,condicao_pagamento_id:source.condicao_pagamento_id,
        validade_em:'2027-04-01T00:00:00.000Z',itens:source.itens.map(item=>({produto_id:item.produto_id,
          unidade_id:item.unidade_id,descricao:item.descricao,unidade_sigla:item.unidade_sigla,
          quantidade:item.quantidade,preco_unitario:item.preco_unitario,desconto:item.desconto}))};
      await assert.rejects(()=>f.runtime.orcamentoService.createVersion(ctx,source.id,versionPayload),(error:any)=>error.code==='ORCAMENTO_ALREADY_CONVERTED');
      const priorEvents=(await f.runtime.auditRepo.listByEntity('Orcamento',source.id)).length;
      await assert.rejects(()=>f.runtime.orcamentoService.update(ctx,source.id,versionPayload),(error:any)=>error.code==='ORCAMENTO_ALREADY_CONVERTED');
      await assert.rejects(()=>f.runtime.orcamentoService.cancel(ctx,source.id),(error:any)=>error.code==='ORCAMENTO_ALREADY_CONVERTED');
      assert.equal((await f.runtime.auditRepo.listByEntity('Orcamento',source.id)).length,priorEvents);
      assert.equal((await f.pg.query('SELECT id FROM pedidos WHERE group_id=$1 AND empresa_id=$2',[identity.groupId,identity.empresaId])).rows.length,1);
      assert.equal((await f.runtime.orcamentoService.get(ctx,source.id)).status,'EM_ABERTO');
      assert.equal((await f.runtime.pedidoService.get(ctx,order.id)).orcamento_id,source.id);
    } finally { await f.close(); }
  });

  test(`${engine}: conversão e versionamento concorrentes não confirmam dois caminhos da cadeia`, { skip: engine === 'PostgreSQL real' && !url }, async () => {
    const f=await boot(engine==='PGlite'?new PGlite():await isolatedPostgres(url!));
    try {
      await f.pg.query("UPDATE profiles SET permissoes=jsonb_set(jsonb_set(permissoes,'{Comercial,orcamento}', '[\"criar\",\"visualizar\",\"versionar\"]'::jsonb),'{Comercial,pedido}', '[\"criar\",\"visualizar\",\"converter-pedido\"]'::jsonb) WHERE id=$1",[identity.actorId]);
      const {tipo_operacao:_operation,data_entrega_solicitada:_delivery,...quote}=f.envelope.documento;
      const created=await f.send({...f.envelope,tipo:'Orcamento',documento:{...quote,validade_em:'2027-03-01T00:00:00.000Z'}});
      assert.equal(created.status,201);
      const ctx={groupId:identity.groupId,empresaId:identity.empresaId,actorId:identity.actorId,scopeType:'empresa' as const,requestId:'synthetic-chain-race'};
      const source=await f.runtime.orcamentoService.get(ctx,created.body.data.id);
      const versionPayload={cliente_empresa_id:source.cliente_empresa_id,condicao_pagamento_id:source.condicao_pagamento_id,
        validade_em:'2027-04-01T00:00:00.000Z',itens:source.itens.map(item=>({produto_id:item.produto_id,
          unidade_id:item.unidade_id,descricao:item.descricao,unidade_sigla:item.unidade_sigla,
          quantidade:item.quantidade,preco_unitario:item.preco_unitario,desconto:item.desconto}))};
      const outcomes=await Promise.allSettled([
        f.runtime.pedidoService.convert(ctx,source.id,{tipo_operacao:'RETIRADA',data_entrega_solicitada:'2027-03-10T00:00:00.000Z'}),
        f.runtime.orcamentoService.createVersion(ctx,source.id,versionPayload),
      ]);
      assert.equal(outcomes.filter(outcome=>outcome.status==='fulfilled').length,1);
      const pedidos=await f.pg.query('SELECT id FROM pedidos WHERE group_id=$1 AND empresa_id=$2',[identity.groupId,identity.empresaId]);
      const versions=await f.runtime.orcamentoService.listVersions(ctx,source.id);
      assert.ok((pedidos.rows.length===1&&versions.length===1)||(pedidos.rows.length===0&&versions.length===2));
    } finally { await f.close(); }
  });

  test(`${engine}: 026 blocks unclassified history before DDL and preserves classified snapshots on repeat`, { skip: engine === 'PostgreSQL real' && !url }, async () => {
    const db=engine==='PGlite'?new PGlite():await isolatedPostgres(url!);
    try {
      await db.exec('CREATE TABLE pedidos(id uuid PRIMARY KEY,group_id uuid,empresa_id uuid,numero bigint); CREATE TABLE pedido_itens(id uuid PRIMARY KEY); CREATE TABLE schema_migrations(id text PRIMARY KEY);');
      const header=randomUUID(),item=randomUUID();
      await db.query('INSERT INTO pedidos VALUES($1,$2,$3,1)',[header,S.groupA,S.empresaA]);
      await db.query('INSERT INTO pedido_itens VALUES($1)',[item]);
      const before=await pedidoHistorico026Preflight(db as never);
      assert.equal(before.blocked,true);
      assert.equal(before.pedidos,1);
      assert.equal(before.itens,1);
      assert.equal(before.porEmpresa[0]?.empresaId,S.empresaA);
      assert.ok(before.reasons.includes('PEDIDO_HISTORICAL_TYPE_MAPPING_REQUIRED'));
      const migration=readFileSync(new URL('../migrations/026_pedidos_tipo_comercial.sql',import.meta.url),'utf8');
      await assert.rejects(()=>db.transaction(async tx=>{
        await tx.exec(migration);
        await tx.query("INSERT INTO schema_migrations VALUES('026_pedidos_tipo_comercial.sql')");
      }),/PEDIDO_HISTORICAL_TYPE_MAPPING_REQUIRED/);
      assert.equal((await db.query("SELECT attname FROM pg_attribute WHERE attrelid IN ('pedidos'::regclass,'pedido_itens'::regclass) AND attname IN ('tipo_comercial','tipo_comercial_snapshot') AND NOT attisdropped")).rows.length,0);
      assert.equal((await db.query('SELECT id FROM schema_migrations')).rows.length,0);
      assert.equal((await db.query('SELECT id FROM pedidos')).rows[0].id,header);
      assert.equal((await db.query('SELECT id FROM pedido_itens')).rows[0].id,item);
      // Explicit synthetic mapping simulates the separately approved historical lot.
      await db.exec('ALTER TABLE pedidos ADD COLUMN tipo_comercial text;');
      const partial=await pedidoHistorico026Preflight(db as never);
      assert.equal(partial.blocked,true);
      assert.ok(partial.reasons.includes('HISTORICAL_CLASSIFICATION_PROVENANCE_REQUIRED'));
      await db.exec('ALTER TABLE pedido_itens ADD COLUMN tipo_comercial_snapshot text;');
      await db.query("UPDATE pedidos SET tipo_comercial='SERVICO' WHERE id=$1",[header]);
      await db.query("UPDATE pedido_itens SET tipo_comercial_snapshot='SERVICO' WHERE id=$1",[item]);
      await db.exec(migration);await db.exec(migration);
      const classified=await pedidoHistorico026Preflight(db as never);
      assert.equal(classified.blocked,true);
      assert.deepEqual(classified.reasons,['HISTORICAL_CLASSIFICATION_PROVENANCE_REQUIRED']);
      assert.equal((await db.query('SELECT tipo_comercial FROM pedidos')).rows[0].tipo_comercial,'SERVICO');
      assert.equal((await db.query('SELECT tipo_comercial_snapshot FROM pedido_itens')).rows[0].tipo_comercial_snapshot,'SERVICO');
      await assert.rejects(()=>db.query('UPDATE pedidos SET tipo_comercial=NULL'),(e:unknown)=>(e as {code:string}).code==='23502');
    } finally { await db.close(); }
  });

  test(`${engine}: unknown product type rejects channel sale without documents or consumed retry key`, { skip: engine === 'PostgreSQL real' && !url }, async () => {
    const f=await boot(engine==='PGlite'?new PGlite():await isolatedPostgres(url!));
    try {
      await f.pg.query('UPDATE produtos SET tipo_item=$1 WHERE id=$2',['LEGADO_SEM_MAPEAMENTO',S.produtoA]);
      const rejected=await f.send(f.envelope,{nonce:'unknown-product-type'});
      assert.equal(rejected.status,422); assert.equal(rejected.body.error?.code,'PEDIDO_TIPO_COMERCIAL_INVALIDO');
      for (const table of ['pedidos','pedido_itens','pedido_historico','audit_logs','integration_events']) {
        assert.equal((await f.pg.query('SELECT id FROM '+table)).rows.length,0);
      }
      await f.pg.query('UPDATE produtos SET tipo_item=$1 WHERE id=$2',['Revenda',S.produtoA]);
      const accepted=await f.send(f.envelope,{nonce:'unknown-product-type'});
      assert.equal(accepted.status,201);
      assert.equal((await f.pg.query('SELECT tipo_comercial FROM pedidos')).rows[0].tipo_comercial,'REVENDA');
    } finally { await f.close(); }
  });

  test(`${engine}: historical quote roots survive repeatable 027 and prohibit null roots`, { skip: engine === 'PostgreSQL real' && !url }, async () => {
    const db = engine === 'PGlite' ? new PGlite() : await isolatedPostgres(url!);
    try {
      await db.exec(`CREATE TABLE orcamentos(id uuid PRIMARY KEY,group_id uuid NOT NULL,empresa_id uuid NOT NULL,numero text,status text,
        UNIQUE(id,group_id,empresa_id),CONSTRAINT orcamentos_empresa_id_numero_key UNIQUE(empresa_id,numero));`);
      const id = randomUUID();
      await db.query("INSERT INTO orcamentos VALUES($1,$2,$3,'00000001','EM_ABERTO')", [id,S.groupA,S.empresaA]);
      const migration = readFileSync(new URL('../migrations/027_orcamentos_versao.sql', import.meta.url), 'utf8');
      await db.exec(migration); await db.exec(migration);
      assert.equal((await db.query('SELECT orcamento_raiz_id FROM orcamentos WHERE id=$1',[id])).rows[0].orcamento_raiz_id,id);
      await assert.rejects(() => db.query('UPDATE orcamentos SET orcamento_raiz_id=NULL WHERE id=$1',[id]), (e: unknown)=>(e as {code:string}).code==='23502');
    } finally { await db.close(); }
  });

  test(`${engine}: four channel quotes version atomically without transport identity duplication`, { skip: engine === 'PostgreSQL real' && !url }, async () => {
    const f = await boot(engine === 'PGlite' ? new PGlite() : await isolatedPostgres(url!));
    try {
      await f.pg.query('UPDATE profiles SET permissoes=$1::jsonb WHERE id=$2', [JSON.stringify({Integracoes:{vendas:['importar','visualizar']},Comercial:{orcamento:['criar','visualizar','versionar']}}), S.runtimeActorA]);
      const ctx = {groupId:S.groupA,empresaId:S.empresaA,actorId:S.runtimeActorA,requestId:'synthetic-version'};
      const {tipo_operacao:_tipo,data_entrega_solicitada:_data,...base}=f.envelope.documento;
      const documento={...base,validade_em:'2027-01-01T00:00:00.000Z'};
      const versionPayload={...documento,itens:documento.itens.map(item=>({...item,preco_unitario:'999',desconto:'0'}))};
      for (const channel of ['SITE','APP','CHATBOT','MARKETPLACE']) {
        const envelope={...f.envelope,tipo:'Orcamento',idempotencyKey:'version-'+channel,documento};
        const response=await f.send(envelope,{channel:'synthetic-'+channel,nonce:'version-create-'+channel});
        assert.equal(response.status,201); const id=response.body.data!.id;
        const first=await f.runtime.orcamentoService.get(ctx,id);
        const next=await f.runtime.orcamentoService.createVersion(ctx,id,versionPayload);
        assert.equal(next.versao,2); assert.equal(next.orcamento_raiz_id,id); assert.equal(next.total,'51.000000');
        assert.equal(next.origem,channel); assert.equal(next.canal,channel);
        assert.equal(next.external_id,null); assert.equal(next.idempotency_key,null);
        const history=await f.runtime.orcamentoService.listVersions(ctx,id);
        assert.deepEqual(history.map(q=>q.versao),[2,1]);
        assert.equal(history[1].external_id,first.external_id); assert.equal(history[1].supersedido_por_id,next.id);
        const retry=await f.send(envelope,{channel:'synthetic-'+channel,nonce:'version-retry-'+channel});
        assert.equal(retry.status,200); assert.equal(retry.body.data!.id,id);
        assert.equal((await f.pg.query('SELECT id FROM orcamentos WHERE orcamento_raiz_id=$1',[id])).rows.length,2);
        await assert.rejects(()=>f.runtime.orcamentoService.get({...ctx,empresaId:S.empresaA2},next.id));
        await f.pg.exec(`CREATE FUNCTION reject_quote_version_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
          IF NEW.entity='Orcamento' THEN RAISE EXCEPTION 'SYNTHETIC_QUOTE_AUDIT_FAILURE'; END IF; RETURN NEW; END $$;
          CREATE TRIGGER quote_version_audit BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION reject_quote_version_audit();`);
        const audits=(await f.pg.query('SELECT id FROM audit_logs')).rows.length;
        await assert.rejects(()=>f.runtime.orcamentoService.createVersion(ctx,next.id,versionPayload),/SYNTHETIC_QUOTE_AUDIT_FAILURE/);
        assert.equal((await f.pg.query('SELECT id FROM audit_logs')).rows.length,audits);
        assert.equal((await f.runtime.orcamentoService.get(ctx,next.id)).status,'EM_ABERTO');
        assert.equal((await f.runtime.orcamentoService.listVersions(ctx,id)).length,2);
        await f.pg.exec('DROP TRIGGER quote_version_audit ON audit_logs; DROP FUNCTION reject_quote_version_audit();');
        const third=await f.runtime.orcamentoService.createVersion(ctx,next.id,versionPayload);
        assert.equal(third.versao,3); assert.equal(third.orcamento_raiz_id,id);
        assert.equal((await f.pg.query('SELECT id FROM audit_logs')).rows.length,audits+2);
        assert.equal((await f.pg.query("SELECT id FROM orcamentos WHERE orcamento_raiz_id=$1 AND status='EM_ABERTO'",[id])).rows.length,1);
      }
    } finally { await f.close(); }
  });
}

for (const engine of ['PGlite', 'PostgreSQL real']) {
  test(`${engine}: canonical 025 repeats safely and constraint failure never records migration`, { skip: engine === 'PostgreSQL real' && !url }, async () => {
    const db = engine === 'PGlite' ? new PGlite() : await isolatedPostgres(url!);
    try {
      await db.exec('CREATE TABLE pedidos(id uuid PRIMARY KEY, group_id uuid, empresa_id uuid, orcamento_id uuid, numero bigint, origem text); CREATE TABLE schema_migrations(id text PRIMARY KEY);');
      const manual = randomUUID(), converted = randomUUID();
      await db.query('INSERT INTO pedidos(id,numero,orcamento_id) VALUES($1,1,NULL),($2,2,$3)', [manual, converted, randomUUID()]);
      const migration = readFileSync(new URL('../migrations/025_pedidos_origem_canal_idempotency.sql', import.meta.url), 'utf8');
      await db.exec(migration); await db.exec(migration);
      assert.deepEqual((await db.query('SELECT origem FROM pedidos ORDER BY numero')).rows.map(r => r.origem), ['MANUAL', 'ORCAMENTO']);
      await assert.rejects(() => db.query('UPDATE pedidos SET origem=NULL WHERE id=$1', [manual]), (e: unknown) => (e as {code: string}).code === '23502');
      await db.exec('ALTER TABLE pedidos ALTER COLUMN origem DROP NOT NULL;');
      await db.query('UPDATE pedidos SET origem=NULL WHERE id=$1', [manual]);
      // A real trigger defeats the backfill, reproducing a legacy NULL that must abort.
      await db.exec("CREATE FUNCTION preserve_legacy_null() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.origem:=NULL; RETURN NEW; END $$; CREATE TRIGGER preserve_legacy_null BEFORE UPDATE ON pedidos FOR EACH ROW EXECUTE FUNCTION preserve_legacy_null();");
      await assert.rejects(() => db.transaction(async tx => {
        await tx.exec(migration);
        await tx.query("INSERT INTO schema_migrations(id) VALUES('025_pedidos_origem_canal_idempotency.sql')");
      }), (e: unknown) => (e as {code: string}).code === '23502');
      assert.equal((await db.query('SELECT id FROM schema_migrations')).rows.length, 0);
      assert.equal((await db.query('SELECT origem FROM pedidos WHERE id=$1', [manual])).rows[0].origem, null);
    } finally { await db.close(); }
  });
}
test('real PostgreSQL FORCE RLS fences reads, writes and claims for a non-bypass role and resets scope per transaction', { skip: !url }, async () => {
  const f = await outboxFixture(await isolatedPostgres(url!));
  const role = `omni_role_${randomUUID().replaceAll('-','')}`;
  const schema = (await f.pg.query<{ name: string }>('SELECT current_schema() AS name')).rows[0].name;
  assert.match(schema,/^omni_test_[a-f0-9]{32}$/);
  let created = false;
  const denied = (e: unknown) => (e as { code: string }).code==='42501';
  try {
    const migration = readFileSync(new URL('../migrations/033_integration_events_company_rls.sql', import.meta.url), 'utf8');
    await f.pg.exec(migration); await f.pg.exec(migration); // canonical migration is repeatable
    const own = await f.event(); const other = await f.event({ empresa: S.empresaA2 });
    await f.pg.exec(`CREATE ROLE ${role} NOSUPERUSER NOBYPASSRLS NOLOGIN`); created = true;
    await f.pg.exec(`GRANT USAGE ON SCHEMA ${schema} TO ${role}; GRANT SELECT,INSERT,UPDATE ON integration_events TO ${role}`);
    const flags = (await f.pg.query<{ rolsuper: boolean; rolbypassrls: boolean }>('SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=$1',[role])).rows[0];
    assert.equal(flags.rolsuper,false); assert.equal(flags.rolbypassrls,false);
    await f.pg.transaction(async (tx) => {
      await tx.exec(`SET LOCAL ROLE ${role}`);
      assert.equal((await tx.query('SELECT id FROM integration_events')).rows.length,0);
      await tx.query("SELECT set_config('erp.group_id',$1,true),set_config('erp.empresa_id',$2,true)",[S.groupA,S.empresaA]);
      assert.deepEqual((await tx.query('SELECT id FROM integration_events')).rows.map((r) => r.id),[own]);
      assert.equal((await tx.query('UPDATE integration_events SET attempts=1 WHERE id=$1 RETURNING id',[other])).rows.length,0);
      const claimed = await tx.query("SELECT id FROM integration_events WHERE status='pending' ORDER BY id FOR UPDATE SKIP LOCKED");
      assert.deepEqual(claimed.rows.map((r) => r.id),[own]);
    });
    // New transaction must not inherit trusted session context or privileged role.
    await f.pg.transaction(async (tx) => {
      await tx.exec(`SET LOCAL ROLE ${role}`);
      assert.equal((await tx.query('SELECT id FROM integration_events')).rows.length,0);
    });
    await assert.rejects(f.pg.transaction(async (tx) => {
      await tx.exec(`SET LOCAL ROLE ${role}`);
      await tx.query("SELECT set_config('erp.group_id',$1,true),set_config('erp.empresa_id',$2,true)",[S.groupA,S.empresaA]);
      await tx.query('UPDATE integration_events SET empresa_id=$2 WHERE id=$1',[own,S.empresaA2]);
    }),denied);
    await assert.rejects(f.pg.transaction(async (tx) => {
      await tx.exec(`SET LOCAL ROLE ${role}`);
      await tx.query("SELECT set_config('erp.group_id',$1,true),set_config('erp.empresa_id',$2,true)",[S.groupA,S.empresaA]);
      await tx.query("INSERT INTO integration_events(group_id,empresa_id,source,event_type) VALUES($1,$2,'ERP','catalogo.reconciliado')",[S.groupB,S.empresaB]);
    }),denied);
    await assert.rejects(f.pg.transaction(async (tx) => {
      await tx.exec('SET LOCAL ROLE '+role);
      await tx.query("SELECT set_config('erp.group_id',$1,true),set_config('erp.empresa_id',$2,true)",[S.groupA,S.empresaA]);
      await tx.query("INSERT INTO integration_events(group_id,empresa_id,source,event_type) VALUES($1,NULL,'ERP','catalogo.reconciliado')",[S.groupA]);
    }),denied);
    assert.equal((await f.pg.query('SELECT empresa_id FROM integration_events WHERE id=$1',[own])).rows[0].empresa_id,S.empresaA);
  } finally {
    try {
      if (created) await f.pg.exec(`REVOKE SELECT,INSERT,UPDATE ON integration_events FROM ${role}; REVOKE USAGE ON SCHEMA ${schema} FROM ${role}; DROP ROLE ${role}`);
    } finally { await f.close(); }
  }
});
