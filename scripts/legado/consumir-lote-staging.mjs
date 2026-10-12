#!/usr/bin/env node
/**
 * Consumidor do lote legado em staging — reutiliza mapear-registro-sintetico + migracaoErpPolicy.
 * Nao le HD real. Nao grava Postgres operacional. Nao duplica mapper.
 *
 * Uso tipico (sintetico / ensaio):
 *   node scripts/legado/consumir-lote-staging.mjs
 *
 * Entrada: rows ja tipadas { entidade, ...campos }.
 * Saida: comprovados / quarentena / rejeicoes / reusos / reconciliacao / auditoria.
 */
import {
  buildReconciliacaoMigracao,
  MIGRACAO_DESTINO_STAGING,
  stampMigracaoRecord,
} from '../../src/components/lib/migracaoErpPolicy.js';
import {
  catalogarProdutoClasseUnidadeLegado,
  avaliarQuarentenaLegado,
  buildChaveIdempotenteMigracaoLegado,
  LEGADO_MESTRES_COMPARTILHADOS,
  mapLegadoLoteSintetico,
  mapLegadoRowToCanonicalStub,
  resolverEmpresaLegadoCodigo,
} from './mapear-registro-sintetico.mjs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Catalog-only pilot preflight. Reuses the canonical identity probe; never authorizes an import. */
export async function inspecionarDestinoPilotoLegado(db,destino,{inspecionarIdentidade}={}) {
  if(typeof db?.query!=='function'||typeof inspecionarIdentidade!=='function'
    ||typeof destino?.database!=='string'||!destino.database.trim()||typeof destino?.schema!=='string'||!destino.schema.trim())
    throw new Error('LEGACY_PREFLIGHT_CONTRACT_REQUIRED');
  const identity=await inspecionarIdentidade(db,{database:destino.database,schema:destino.schema,requireRestrictedLogin:true});
  const checks={destino:identity?.destination===true,loginRestrito:identity?.restrictedRole===true&&identity?.restrictedLogin===true};
  const report=()=>({ready:Object.values(checks).every(x=>x===true),checks,bloqueios:Object.keys(checks).filter(k=>checks[k]!==true),
    somente_leitura:true,scope:'grupo_schema_only',aprovacao_importacao_operacional:false,
    gates_nao_homologados:['identidade_grupo','rbac_ator','policies_comportamentais','fonte_equivalente','mapa_classe_unidade','backup_restauracao']});
  if(!checks.destino||!checks.loginRestrito)return report();
  const relations=await db.query(`SELECT c.relname AS name,c.oid::text AS oid,c.relkind AS kind,c.relrowsecurity AS rls,c.relforcerowsecurity AS force,
    NOT EXISTS(SELECT 1 FROM aclexplode(COALESCE(c.relacl,acldefault('r',c.relowner))) a
      WHERE a.grantee=0 AND a.privilege_type IN ('SELECT','INSERT','UPDATE','DELETE','TRUNCATE'))
    AND NOT EXISTS(SELECT 1 FROM pg_attribute att,LATERAL aclexplode(att.attacl) a WHERE att.attrelid=c.oid
      AND att.attnum>0 AND NOT att.attisdropped AND a.grantee=0 AND a.privilege_type IN ('SELECT','INSERT','UPDATE')) AS public_safe,
    has_table_privilege(current_user,c.oid,'SELECT') AND has_table_privilege(current_user,c.oid,'INSERT')
      AND has_table_privilege(current_user,c.oid,'UPDATE') AS grants
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname=$1 AND c.relname IN ('clientes','produtos')`,[destino.schema]);
  checks.mestres=relations.rows.length===2&&relations.rows.every(r=>r.kind==='r');
  checks.rls=checks.mestres&&relations.rows.every(r=>r.rls===true&&r.force===true);
  checks.grants=checks.mestres&&relations.rows.every(r=>r.grants===true);
  checks.publicAcl=checks.mestres&&relations.rows.every(r=>r.public_safe===true);
  checks.colunas=checks.mestres;checks.identidadeUnica=checks.mestres;
  for(const relation of relations.rows.filter(r=>r.kind==='r')) {
    const attrs=await db.query('SELECT attname AS name,attnotnull AS required FROM pg_attribute WHERE attrelid=$1::oid AND attnum>0 AND NOT attisdropped',[relation.oid]);
    const columns=new Map(attrs.rows.map(a=>[a.name,a.required]));
    checks.colunas=checks.colunas&&['group_id','empresa_id','codigo','origem','codigo_legado','legacy_id','source_system','migration_batch'].every(c=>columns.has(c))
      &&columns.get('group_id')===true&&columns.get('empresa_id')===false;
    const indexes=await db.query(`SELECT indisvalid AS valid,indisunique AS unique,pg_get_indexdef(indexrelid) AS definition,
      pg_get_expr(indpred,indrelid) AS predicate FROM pg_index WHERE indrelid=$1::oid`,[relation.oid]);
    checks.identidadeUnica=checks.identidadeUnica&&indexes.rows.some(i=>i.valid===true&&i.unique===true
      &&/\(group_id, source_system, codigo_legado\)/.test(i.definition)
      &&String(i.predicate??'').replace(/[()\s]/g,'').toLowerCase()==='source_systemisnotnullandcodigo_legadoisnotnull');
  }
  return report();
}

/** Ordem de dependencia minima para Produtos / Clientes / Fornecedores. */
export const LEGADO_DEPENDENCIA_ORDEM = Object.freeze([
  'empresa',
  'produto',
  'cliente',
  'fornecedor',
  'obra',
  'condicao_pagamento',
]);
const MESTRES_COMPARTILHADOS = new Set(LEGADO_MESTRES_COMPARTILHADOS);

/**
 * Valida dependencias de um registro mapeado (empresa conhecida, codigo, tenant).
 * Fail-closed: sem empresa_id de destino e sem crosswalk autenticado → não comprova.
 * @param {Record<string, unknown>} mapped
 * @param {{
 *   entidadesDisponiveis?: Set<string>,
 *   chavesEmpresa?: Set<string>,
 *   crosswalkEmpresas?: Record<string, string>|Map<string, string>,
 *   requireContratoEntrada?: boolean,
 * }} ctx
 */
export const validarDependenciasLegado = (mapped = {}, ctx = {}) => {
  const rejeicoes = [];
  const entidade = String(mapped.entidade_migracao || '');
  if (!entidade) rejeicoes.push('entidade_ausente');
  if (!mapped.group_id) rejeicoes.push('group_id_obrigatorio');
  if (!mapped.codigo_legado) rejeicoes.push('codigo_legado_obrigatorio');
  // Destino canônico obrigatório (exceto o próprio cadastro de empresa).
  const mestreGrupo = MESTRES_COMPARTILHADOS.has(entidade) && mapped.scopeType === 'group';
  if (entidade && entidade !== 'empresa' && !mestreGrupo && !mapped.empresa_id && !mapped.target_empresa_id) {
    rejeicoes.push('empresa_destino_obrigatoria');
  }
  if (mestreGrupo && mapped.empresa_id) rejeicoes.push('mestre_grupo_com_empresa');
  if (!mestreGrupo && entidade !== 'empresa' && !mapped.codigo_empresa_legado) {
    rejeicoes.push('empresa_legado_comprovada_obrigatoria');
  }
  if (mapped.codigo_empresa_legado != null && mapped.codigo_empresa_legado !== '') {
    const emp = resolverEmpresaLegadoCodigo(mapped.codigo_empresa_legado);
    if (emp.quarentena || emp.conhecido === false) {
      rejeicoes.push('empresa_legado_nao_resolvida');
    }
    if (!mestreGrupo && ctx.chavesEmpresa instanceof Set && emp.conhecido && !ctx.chavesEmpresa.has(String(emp.codigo))) {
      rejeicoes.push('empresa_destino_ausente_no_lote');
    }
    const crosswalk = ctx.crosswalkEmpresas;
    if (crosswalk && !mestreGrupo) {
      const code = String(emp.codigo || mapped.codigo_empresa_legado);
      const target = crosswalk instanceof Map ? crosswalk.get(code) : crosswalk[code];
      if (!target) rejeicoes.push('crosswalk_empresa_ausente');
      else if ((mapped.empresa_id && mapped.empresa_id !== target)
        || (mapped.target_empresa_id && mapped.target_empresa_id !== target)
        || (!mapped.empresa_id && !mapped.target_empresa_id)) {
        rejeicoes.push('empresa_destino_divergente_do_crosswalk');
      }
    }
  }
  if (ctx.requireContratoEntrada !== false && !ctx.contratoEntradaPresente) {
    rejeicoes.push('contrato_entrada_ausente');
  }
  if (!mestreGrupo && ctx.requireContratoEntrada !== false && !ctx.crosswalkEmpresas) {
    rejeicoes.push('crosswalk_empresa_ausente');
  }
  if (ctx.entidadesDisponiveis instanceof Set && entidade && !ctx.entidadesDisponiveis.has(entidade)) {
    rejeicoes.push('entidade_fora_do_lote');
  }
  return { ok: rejeicoes.length === 0, rejeicoes };
};

/**
 * Envelope de auditoria sanitizado (sem PII/documento completo).
 * @param {Record<string, unknown>} mapped
 * @param {{ acao: string, resultado: string, motivos?: string[] }} meta
 */
export const buildAuditoriaConsumoLegado = (mapped = {}, meta = { acao: 'consumir', resultado: 'ok' }) => ({
  acao: meta.acao,
  resultado: meta.resultado,
  motivos: meta.motivos || [],
  entidade: mapped.entidade_migracao || null,
  group_id: mapped.group_id || null,
  empresa_id: mapped.empresa_id || null,
  codigo_legado: mapped.codigo_legado || null,
  chave_idempotente_migracao: mapped.chave_idempotente_migracao || null,
  destino_migracao: mapped.destino_migracao || MIGRACAO_DESTINO_STAGING,
  importacao_erp: true,
  timestamp: new Date().toISOString(),
});

/**
 * Consome lote sintetico/staging tipado: mapeia, valida deps, separa quarentena/rejeicao,
 * deduplica (idempotencia) e monta reconciliacao + auditoria.
 *
 * @param {Array<Record<string, unknown>>} rows
 * @param {{
 *   entidade?: string,
 *   groupId?: string,
 *   empresaId?: string,
 *   arquivoNome?: string,
 *   chavesJaGravadas?: Array<string|{chave:string,fingerprint:string}>,
 *   contratoEntrada?: { coorte?: string, crosswalkEmpresas?: Record<string, string>, linhagemHash?: string },
 *   produtoClassUnitMap?: Record<string, {tipo_item?:string,tipo_produto?:string,unidade_medida_id:string}>,
 *   requireContratoEntrada?: boolean,
 * }} opts
 */
export const consumirLoteStagingLegado = (rows = [], opts = {}) => {
  const entidade = opts.entidade || 'cliente';
  const lote = mapLegadoLoteSintetico(rows, {
    entidade,
    groupId: opts.groupId,
    empresaId: opts.empresaId,
    arquivoNome: opts.arquivoNome || `staging_${entidade}.csv`,
    produtoClassUnitMap: opts.produtoClassUnitMap,
  });

  const chavesPrevias = new Map();
  const chavesPreviasConflitantes = new Set();
  for (const entry of opts.chavesJaGravadas || []) {
    const [chave,fingerprint] = typeof entry === 'string'
      ? [entry,''] : [String(entry?.chave || ''),String(entry?.fingerprint || '')];
    if (!chave) continue;
    if (chavesPrevias.has(chave) && chavesPrevias.get(chave) !== fingerprint) chavesPreviasConflitantes.add(chave);
    else chavesPrevias.set(chave,fingerprint);
  }
  const entidadesDisponiveis = new Set(LEGADO_DEPENDENCIA_ORDEM);
  // Codigos legados CPA/3Z conhecidos — crosswalk de IDs de destino vem do contrato.
  const chavesEmpresa = new Set(
    opts.contratoEntrada?.crosswalkEmpresas
      ? Object.keys(opts.contratoEntrada.crosswalkEmpresas)
      : ['1', '2', '3', '5'],
  );
  const crosswalkEmpresas = opts.contratoEntrada?.crosswalkEmpresas || null;
  const requireContratoEntrada = opts.requireContratoEntrada !== false;

  const comprovados = [];
  const quarentena = [];
  const rejeicoes = [...lote.erros, ...lote.conflitos];
  const reusos = [];
  const chavesValidadas = new Set();
  const auditoria = [];
  // Do not elect the first source row as a winner when any row disputes its identity.
  const identidadesConflitantes = new Set([...chavesPreviasConflitantes,...lote.conflitos.map(item => item.chave_idempotente_migracao)]);

  for (const mapped of lote.gravados) {
    if (identidadesConflitantes.has(mapped.chave_idempotente_migracao)) {
      const motivos = ['identidade_legado_divergente_no_lote'];
      quarentena.push({ codigo_legado: mapped.codigo_legado, motivos,
        chave_idempotente_migracao: mapped.chave_idempotente_migracao });
      auditoria.push(buildAuditoriaConsumoLegado(mapped, {
        acao: 'consumir', resultado: 'quarentena_identidade', motivos,
      }));
      continue;
    }
    if (mapped.quarentena) {
      quarentena.push({
        codigo_legado: mapped.codigo_legado,
        motivos: mapped.quarentena_motivos,
        chave_idempotente_migracao: mapped.chave_idempotente_migracao,
      });
      auditoria.push(buildAuditoriaConsumoLegado(mapped, {
        acao: 'consumir',
        resultado: 'quarentena',
        motivos: mapped.quarentena_motivos || [],
      }));
      continue;
    }

    const deps = validarDependenciasLegado(mapped, {
      entidadesDisponiveis,
      chavesEmpresa,
      crosswalkEmpresas,
      requireContratoEntrada,
      contratoEntradaPresente: Boolean(opts.contratoEntrada?.coorte),
    });
    if (!deps.ok) {
      const soContrato = deps.rejeicoes.every((r) => r === 'contrato_entrada_ausente' || r === 'crosswalk_empresa_ausente');
      if (soContrato || deps.rejeicoes.includes('contrato_entrada_ausente')) {
        quarentena.push({
          codigo_legado: mapped.codigo_legado,
          motivos: deps.rejeicoes,
          chave_idempotente_migracao: mapped.chave_idempotente_migracao,
        });
        auditoria.push(buildAuditoriaConsumoLegado(mapped, {
          acao: 'consumir',
          resultado: 'quarentena_contrato',
          motivos: deps.rejeicoes,
        }));
        continue;
      }
      rejeicoes.push({
        codigo_legado: mapped.codigo_legado,
        rejeicoes: deps.rejeicoes,
        chave_idempotente_migracao: mapped.chave_idempotente_migracao,
      });
      auditoria.push(buildAuditoriaConsumoLegado(mapped, {
        acao: 'consumir',
        resultado: 'rejeitado',
        motivos: deps.rejeicoes,
      }));
      continue;
    }

    if (chavesPrevias.has(mapped.chave_idempotente_migracao)) {
      const anterior = chavesPrevias.get(mapped.chave_idempotente_migracao);
      if (!anterior || anterior !== mapped.fingerprint_migracao) {
        quarentena.push({ codigo_legado: mapped.codigo_legado,
          motivos: ['reuso_sem_fingerprint_igual'],
          chave_idempotente_migracao: mapped.chave_idempotente_migracao });
        auditoria.push(buildAuditoriaConsumoLegado(mapped, {
          acao: 'consumir', resultado: 'conflito_reuso', motivos: ['reuso_sem_fingerprint_igual'],
        }));
        continue;
      }
      reusos.push({
        codigo_legado: mapped.codigo_legado,
        chave_idempotente_migracao: mapped.chave_idempotente_migracao,
        motivo: 'idempotente_ja_consumido',
      });
      chavesValidadas.add(mapped.chave_idempotente_migracao);
      auditoria.push(buildAuditoriaConsumoLegado(mapped, {
        acao: 'consumir',
        resultado: 'reuso_idempotente',
        motivos: ['chave_ja_presente'],
      }));
      continue;
    }

    comprovados.push(mapped);
    chavesValidadas.add(mapped.chave_idempotente_migracao);
    chavesPrevias.set(mapped.chave_idempotente_migracao, mapped.fingerprint_migracao);
    auditoria.push(buildAuditoriaConsumoLegado(mapped, {
      acao: 'consumir',
      resultado: 'comprovado_staging',
    }));
  }

  // Duplicata so e reuso quando sua raiz passou pelos mesmos gates de entrada.
  for (const dup of lote.reusos) {
    if (chavesValidadas.has(dup.chave_idempotente_migracao)) reusos.push(dup);
    else {
      const motivos = ['reuso_origem_nao_validada'];
      quarentena.push({ codigo_legado: dup.codigo_legado,
        chave_idempotente_migracao: dup.chave_idempotente_migracao, motivos });
      const raiz = lote.gravados.find((r) => r.chave_idempotente_migracao === dup.chave_idempotente_migracao);
      auditoria.push(buildAuditoriaConsumoLegado(raiz, { acao: 'consumir', resultado: 'quarentena_reuso', motivos }));
    }
  }

  const reconciliacao = buildReconciliacaoMigracao({
    origem: rows,
    gravados: comprovados,
    reusos,
    campoValor: 'valor',
  });

  return {
    entidade,
    destino_migracao: MIGRACAO_DESTINO_STAGING,
    importacao_erp: true,
    importado_operacional: false,
    contrato_entrada: Boolean(opts.contratoEntrada?.coorte),
    coorte: opts.contratoEntrada?.coorte || null,
    comprovados,
    quarentena,
    rejeicoes,
    reusos,
    reconciliacao,
    auditoria,
    totais: {
      origem: rows.length,
      comprovados: comprovados.length,
      quarentena: quarentena.length,
      rejeicoes: rejeicoes.length,
      reusos: reusos.length,
    },
  };
};

/**
 * Segunda passagem idempotente: mesmos rows nao duplicam comprovados.
 */
export const consumirLoteStagingIdempotente = (rows = [], opts = {}) => {
  const primeiro = consumirLoteStagingLegado(rows, opts);
  const segundo = consumirLoteStagingLegado(rows, {
    ...opts,
    chavesJaGravadas: primeiro.comprovados.map((r) => ({
      chave: r.chave_idempotente_migracao, fingerprint: r.fingerprint_migracao,
    })),
  });
  return { primeiro, segundo };
};

export {
  avaliarQuarentenaLegado,
  buildChaveIdempotenteMigracaoLegado,
  mapLegadoRowToCanonicalStub,
  stampMigracaoRecord,
};

/** Isolated pilot adapter: existing ClienteService owns validation, RBAC, persistence and audit.
 * No SQL, parallel repository, implicit company or operational activation is introduced here.
 */
export const persistirClienteGrupoLegado = async (ctx, mapped, options = {}) => {
  const { service, rbacGuard, tipo, sourceSystem, batch } = options;
  if (!service || !rbacGuard || !sourceSystem || !batch) throw new Error('LEGACY_CANONICAL_CONTRACT_REQUIRED');
  if (!ctx?.groupId || ctx.empresaId || mapped?.group_id !== ctx.groupId
    || mapped.scopeType !== 'group' || mapped.entidade_migracao !== 'cliente' || mapped.quarentena
    || !mapped.codigo_legado || !mapped.documento) throw new Error('LEGACY_SHARED_CLIENT_INVALID');
  if (!['Pessoa Física', 'Pessoa Jurídica'].includes(tipo)) throw new Error('LEGACY_CLIENT_TYPE_REQUIRED');
  await rbacGuard.assertAllowed(ctx, 'Cadastros', 'cliente', 'importar', { allowGlobalWildcard: false });
  const reuseExisting = async () => {
    if (typeof service.findByLegacyIdentity !== 'function') throw new Error('LEGACY_CANONICAL_CONTRACT_REQUIRED');
    const identity = await service.findByLegacyIdentity(ctx, sourceSystem, String(mapped.codigo_legado));
    const suggestion = await service.sugerirVinculo(ctx, { documento: mapped.documento });
    if (!identity && !suggestion.sugestao) return null;
    if (!identity || identity.ativo === false || identity.empresa_id != null
      || !suggestion.sugestao || identity.id !== suggestion.cliente_id) throw new Error('LEGACY_RECONCILIATION_REQUIRED');
    const existing = identity;
    if (existing.codigo_legado !== String(mapped.codigo_legado) || existing.source_system !== sourceSystem
      || existing.migration_batch !== batch || existing.tipo !== tipo
      || (existing.nome || existing.razao_social) !== mapped.nome
      || (existing.nome_fantasia || '') !== (mapped.nome_fantasia || '')) {
      throw new Error('LEGACY_RECONCILIATION_REQUIRED');
    }
    return { registro: existing, reutilizado: true, persistido: true };
  };
  const existing = await reuseExisting();
  if (existing) return existing;
  try {
    const registro = await service.create(ctx, {
      tipo, documento: mapped.documento, empresa_id: null,
      ...(tipo === 'Pessoa Jurídica' ? { razao_social: mapped.nome } : { nome: mapped.nome }),
      ...(mapped.nome_fantasia ? { nome_fantasia: mapped.nome_fantasia } : {}),
      origem: 'MIGRACAO', codigo_legado: String(mapped.codigo_legado),
      legacy_id: String(mapped.codigo_legado), source_system: sourceSystem, migration_batch: batch,
    });
    return { registro, reutilizado: false, persistido: true };
  } catch (error) {
    // Resolve a concurrent unique-document winner by reading, never retrying a write.
    if (!['DUPLICATE_DOCUMENT','LEGACY_RECONCILIATION_REQUIRED'].includes(error?.code)) throw error;
    const winner = await reuseExisting();
    if (winner) return winner;
    // An inactive or otherwise invisible identity requires reconciliation, never restoration.
    throw new Error('LEGACY_RECONCILIATION_REQUIRED');
  }
};
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const sample = [
    {
      cod_cliente: 'C-OK',
      razao_social: 'Cliente Sintetico OK',
      cnpj: '00000000000191',
      group_id: 'g1',
      empresa_id: 'e1',
      codigo_empresa: '1',
      valor: 10,
    },
    {
      cod_cliente: 'C-OK',
      razao_social: 'Cliente Sintetico OK dup',
      group_id: 'g1',
      empresa_id: 'e1',
      codigo_empresa: '1',
      valor: 10,
    },
    {
      cod_cliente: 'C-0',
      nome: 'Quarentena',
      group_id: 'g1',
      empresa_id: 'e1',
      codigo_empresa: '0',
      valor: 1,
    },
  ];
  const { primeiro, segundo } = consumirLoteStagingIdempotente(sample, {
    entidade: 'cliente',
    arquivoNome: 'demo_consumo.csv',
    contratoEntrada: {
      coorte: 'sintetico-demo',
      crosswalkEmpresas: { 1: 'e1', 2: 'e1', 3: 'e1', 5: 'e1' },
    },
  });
  const out = {
    importado_operacional: false,
    primeiro: primeiro.totais,
    segundo: segundo.totais,
    auditoria_primeiro: primeiro.auditoria.length,
    reconciliacao: primeiro.reconciliacao,
  };
  console.log(JSON.stringify(out, null, 2));
  if (segundo.comprovados.length !== 0) {
    console.error('BLOCKED: segunda passagem gerou comprovados novos');
    process.exit(1);
  }
}


/** Compare persisted pilot snapshots through canonical services. The returned report contains no record values or IDs. */
const camposReconciliacaoPiloto = Object.freeze({
  cliente: ['id','group_id','empresa_id','codigo','ativo','origem','source_system','codigo_legado','legacy_id','migration_batch',
    'tipo','nome','documento','razao_social','nome_fantasia','nome_social','inscricao_estadual','inscricao_municipal',
    'email','telefone','celular','status','observacoes'],
  produto: ['id','group_id','empresa_id','codigo','ativo','origem','source_system','codigo_legado','legacy_id','migration_batch',
    'descricao','tipo_item','unidade_medida_id','unidade_principal','descricao_comercial','peso_teorico_kg_m'],
});
const camposObrigatoriosPiloto = Object.freeze({
  cliente: camposReconciliacaoPiloto.cliente.slice(0,14),
  produto: camposReconciliacaoPiloto.produto.slice(0,15),
});

/** Private baseline: keep this snapshot with the private import manifest, never in a public report. */
export const criarSnapshotReconciliacaoLegado = (entidade, registro) => {
  if (!camposReconciliacaoPiloto[entidade] || !registro || typeof registro !== 'object') {
    throw new Error('LEGACY_RECONCILIATION_SNAPSHOT_INVALID');
  }
  return {entidade,registro:Object.fromEntries(camposReconciliacaoPiloto[entidade]
    .map(campo=>[campo,registro[campo] ?? null]))};
};

export const reconciliarPilotoGrupoLegado = async (ctx, snapshots, options = {}) => {
  const {services,rbacGuard} = options;
  if (!ctx?.groupId || ctx.empresaId || !services || !rbacGuard
    || !Array.isArray(snapshots) || !snapshots.length || snapshots.length>1000) {
    throw new Error('LEGACY_RECONCILIATION_CONTRACT_REQUIRED');
  }
  const identities=new Set(),ids=new Set();
  for(const snapshot of snapshots) {
    const {entidade,registro:r} = snapshot ?? {};
    const fields=camposReconciliacaoPiloto[entidade],required=camposObrigatoriosPiloto[entidade];
    if(!fields || !r || typeof r!=='object' || Array.isArray(r) || !services[entidade]?.findByLegacyIdentity
      || required.some(field=>!Object.hasOwn(r,field)) || Object.keys(r).some(field=>!fields.includes(field))
      || Object.values(r).some(value=>value!==null && !['string','number','boolean'].includes(typeof value))
      || Object.values(r).some(value=>typeof value==='number'&&!Number.isFinite(value))
      || r.group_id!==ctx.groupId || r.empresa_id!==null || r.origem!=='MIGRACAO' || typeof r.ativo!=='boolean'
      || typeof r.codigo!=='string' || !/^\d+$/.test(r.codigo)
      || ['id','source_system','codigo_legado','legacy_id','migration_batch'].some(field=>typeof r[field]!=='string'||!r[field].trim())
      || r.legacy_id!==r.codigo_legado) throw new Error('LEGACY_RECONCILIATION_SNAPSHOT_INVALID');
    const identity=JSON.stringify([entidade,r.group_id,r.source_system,r.codigo_legado]),id=JSON.stringify([entidade,r.id]);
    if(identities.has(identity)||ids.has(id))throw new Error('LEGACY_RECONCILIATION_DUPLICATE_SNAPSHOT');
    identities.add(identity);ids.add(id);
  }
  // Permission failures abort the report rather than becoming a successful "missing" row.
  for(const entidade of new Set(snapshots.map(s=>s.entidade))) {
    await rbacGuard.assertAllowed(ctx,'Cadastros',entidade,'visualizar',{allowGlobalWildcard:false});
  }
  const resultados=[];
  for(const [indice,{entidade,registro:expected}] of snapshots.entries()) {
    let actual;
    try {actual=await services[entidade].findByLegacyIdentity(ctx,expected.source_system,expected.codigo_legado);}
    catch(error) {if(error?.code!=='LEGACY_RECONCILIATION_REQUIRED')throw error;
      resultados.push({indice,entidade,resultado:'identidade_ambigua',campos:[]});continue;}
    if(!actual){resultados.push({indice,entidade,resultado:'ausente',campos:[]});continue;}
    const campos=Object.keys(expected).filter(field=>(actual[field] ?? null)!==expected[field]);
    resultados.push({indice,entidade,resultado:campos.length?'divergente':'equivalente',campos});
  }
  return {somente_leitura:true,aprovacao_importacao_operacional:false,
    consistencia:'observacao_por_registro_sem_snapshot_global',
    equivalente:resultados.every(r=>r.resultado==='equivalente'),
    totais:{esperados:snapshots.length,equivalentes:resultados.filter(r=>r.resultado==='equivalente').length,
      divergentes:resultados.filter(r=>r.resultado==='divergente').length,
      ausentes:resultados.filter(r=>r.resultado==='ausente').length,
      ambiguos:resultados.filter(r=>r.resultado==='identidade_ambigua').length},resultados};
};

/** Persisted Produto pilot; all writes remain in the existing canonical service. */
export const persistirProdutoGrupoLegado = async (ctx, mapped, options = {}) => {
  const { service, unidadeService, rbacGuard, sourceSystem, batch, produtoClassUnitMap } = options;
  if (!service || !unidadeService || !rbacGuard || !sourceSystem || !batch || !produtoClassUnitMap) {
    throw new Error('LEGACY_CANONICAL_CONTRACT_REQUIRED');
  }
  if (!ctx?.groupId || ctx.empresaId || mapped?.group_id !== ctx.groupId || mapped.scopeType !== 'group'
    || mapped.entidade_migracao !== 'produto' || mapped.quarentena || mapped.requer_conciliacao_manual
    || !mapped.codigo_legado || !mapped.descricao || !mapped.tipo_item || !mapped.unidade_medida_id) {
    throw new Error('LEGACY_SHARED_PRODUCT_INVALID');
  }
  await rbacGuard.assertAllowed(ctx,'Cadastros','produto','importar',{allowGlobalWildcard:false});
  await rbacGuard.assertAllowed(ctx,'Cadastros','unidade_medida','visualizar',{allowGlobalWildcard:false});
  const unit = await unidadeService.get(ctx,mapped.unidade_medida_id);
  const source = {cod_produto:mapped.codigo_legado,descricao:mapped.descricao,
    classe:mapped.classe_legado,unidade:mapped.unidade_legado,group_id:ctx.groupId};
  const catalogue = catalogarProdutoClasseUnidadeLegado([source],{groupId:ctx.groupId,produtoClassUnitMap,unidadesCanonicas:[unit]});
  const remapped = mapLegadoRowToCanonicalStub(source,{groupId:ctx.groupId,entidade:'produto',produtoClassUnitMap});
  if (catalogue.quantidade_sem_mapa || remapped.tipo_item !== mapped.tipo_item
    || remapped.unidade_medida_id !== mapped.unidade_medida_id || !unit.sigla) {
    throw new Error('LEGACY_PRODUCT_MAPPING_RECONCILIATION_REQUIRED');
  }
  const reuse = async () => {
    const row = await service.findByLegacyIdentity(ctx,sourceSystem,String(mapped.codigo_legado));
    if (!row) return null;
    if (row.ativo !== true || row.empresa_id != null || row.origem !== 'MIGRACAO'
      || row.legacy_id !== String(mapped.codigo_legado) || row.migration_batch !== batch
      || row.descricao !== mapped.descricao || row.tipo_item !== mapped.tipo_item
      || row.unidade_medida_id !== unit.id || row.unidade_principal !== unit.sigla) {
      throw new Error('LEGACY_RECONCILIATION_REQUIRED');
    }
    return {registro:row,reutilizado:true,persistido:true};
  };
  const existing=await reuse();if(existing)return existing;
  try {
    const registro=await service.create(ctx,{empresa_id:null,descricao:mapped.descricao,tipo_item:mapped.tipo_item,
      unidade_medida_id:unit.id,unidade_principal:unit.sigla,origem:'MIGRACAO',codigo_legado:String(mapped.codigo_legado),
      legacy_id:String(mapped.codigo_legado),source_system:sourceSystem,migration_batch:batch});
    return {registro,reutilizado:false,persistido:true};
  } catch(error) {
    if(error?.code !== 'LEGACY_RECONCILIATION_REQUIRED')throw error;
    const winner=await reuse();if(winner)return winner;
    throw new Error('LEGACY_RECONCILIATION_REQUIRED');
  }
};
