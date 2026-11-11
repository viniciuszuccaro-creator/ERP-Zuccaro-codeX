import { randomBytes } from 'node:crypto';
import { protectReviewValue } from './pilot-functional-review-record.mjs';

export function reviewBrowserRuntime() {
  const data = JSON.parse(document.getElementById('review-data').textContent);
  const byId = id => document.getElementById(id);
  const text = (tag, value) => { const node = document.createElement(tag); node.textContent = value; return node; };
  const labels = { VALIDATED_ELIGIBLE: 'Validado e elegivel para uso', IMPORTED_PENDING: 'Importado com pendencia nao critica',
    REVIEW_REQUIRED: 'Disponivel para revisao', HISTORY_ONLY: 'Historico para consulta/conciliacao' };
  let page = 0, selected = null, filtered = data.records, lastDraft = null;
  const showValue = (record, field) => {
    if (!field.originalPresent) return 'Ausente na origem';
    if (field.protected && !record.actions.viewProtected) return 'Protegido';
    if (field.original === null) return 'NULL na origem';
    if (field.original === '') return 'Vazio na origem';
    return typeof field.original === 'object' ? JSON.stringify(field.original) : String(field.original);
  };
  const code = record => { const field = record.fields.find(item => item.name === 'codigo' || item.name === 'codigo_legado');
    return field ? showValue(record, field) : 'Sem codigo comprovado'; };
  const option = (value, label) => { const item = text('option', label); item.value = value; return item; };
  for (const [value, label] of Object.entries(labels)) byId('situation').append(option(value, label));
  for (const entity of [...new Set(data.records.map(record => record.entity))]) byId('entity').append(option(entity, entity));
  byId('total').textContent = String(data.records.length);
  for (const status of Object.keys(labels)) byId('count-' + status).textContent = String(data.records.filter(record => record.status === status).length);
  function inspect(record) {
    selected = record;
    byId('detail').hidden = false;
    byId('selected').textContent = record.entity + ' / ' + code(record);
    byId('status-detail').textContent = record.label;
    byId('provenance').textContent = record.provenance.sourceSystem + ' | ' + record.provenance.file
      + ' | linha ' + record.sourceIndex + ' | SHA-256 ' + record.provenance.fileSha256;
    byId('blocked').textContent = record.blockedOperations.join(', ') || 'Nenhum bloqueio de campo comprovado; permissoes e gates continuam obrigatorios';
    byId('fields').replaceChildren(); byId('field').replaceChildren();
    for (const field of record.fields) {
      const row = document.createElement('tr');
      for (const value of [field.name, showValue(record, field), field.normalization.proposed ?? 'Sem normalizacao comprovada', field.reasons.join(', ') || 'Sem apontamento de campo']) row.append(text('td', value));
      byId('fields').append(row); if (field.editable) byId('field').append(option(field.name, field.name));
    }
    for (const id of ['proposed', 'reason', 'evidence', 'evidence-sha']) byId(id).value = '';
    byId('prepare').disabled = !record.actions.prepareDraft;
    byId('normalization').disabled = !record.actions.prepareDraft;
    byId('message').textContent = record.actions.prepareDraft ? 'Rascunho de revisao. Sem aplicacao ou liberacao.' : 'Revisor e permissoes de importar/editar ainda nao comprovados; somente leitura.';
  }
  function render() {
    const query = byId('search').value.toLocaleLowerCase();
    filtered = data.records.filter(record => (!byId('situation').value || record.status === byId('situation').value)
      && (!byId('entity').value || record.entity === byId('entity').value)
      && (!query || [record.key, code(record), record.provenance.sourceSystem, ...record.reasons.map(reason => reason.field + ' ' + reason.reason)].join(' ').toLocaleLowerCase().includes(query)));
    page = Math.min(page, Math.max(0, Math.ceil(filtered.length / 25) - 1));
    byId('matched').textContent = String(filtered.length);
    byId('page').textContent = `${page + 1} / ${Math.max(1, Math.ceil(filtered.length / 25))}`;
    byId('previous').disabled = page === 0; byId('next').disabled = (page + 1) * 25 >= filtered.length;
    byId('rows').replaceChildren();
    for (const record of filtered.slice(page * 25, page * 25 + 25)) {
      const row = document.createElement('tr');
      for (const value of [record.entity, code(record), record.label, record.reasons.map(reason => reason.field + ': ' + reason.reason).join('; ') || 'Sem apontamento de campo']) row.append(text('td', value));
      const cell = document.createElement('td'), button = text('button', 'Conferir'); button.type = 'button';
      button.addEventListener('click', () => inspect(record)); cell.append(button); row.append(cell); byId('rows').append(row);
    }
    byId('empty').hidden = filtered.length !== 0;
  }
  for (const id of ['search', 'situation', 'entity']) byId(id).addEventListener('input', () => { page = 0; render(); });
  byId('previous').addEventListener('click', () => { page--; render(); });
  byId('next').addEventListener('click', () => { page++; render(); });
  byId('normalization').addEventListener('click', () => {
    const field = selected?.fields.find(item => item.name === byId('field').value);
    if (!selected?.actions.prepareDraft || field?.normalization.proposed == null) { byId('message').textContent = 'Nao existe normalizacao de formato comprovada para este campo.'; return; }
    byId('proposed').value = field.normalization.proposed;
    byId('message').textContent = 'Sugestao de formato: ' + field.normalization.rule + '. Valor original preservado.';
  });
  byId('prepare').addEventListener('click', () => {
    if (!selected?.actions.prepareDraft) return;
    const field = selected.fields.find(item => item.name === byId('field').value);
    if (!field?.editable) { byId('message').textContent = 'Selecione um campo revisavel; identidades e codigos originais sao imutaveis.'; return; }
    const proposedValue = byId('proposed').value, reason = byId('reason').value;
    const format = field?.normalization.proposed === proposedValue && field.normalization.rule != null;
    if (!proposedValue.trim() || !reason.trim() || (!format && (!/^[a-zA-Z0-9:_-]{1,120}$/.test(byId('evidence').value) || !/^[a-f0-9]{64}$/.test(byId('evidence-sha').value)))) {
      byId('message').textContent = 'Informe valor e justificativa; alteracao de significado exige referencia e SHA-256 da evidencia.'; return;
    }
    const signature = JSON.stringify([selected.key, selected.sourceFingerprint, field.name, proposedValue, reason, byId('evidence').value, byId('evidence-sha').value]);
    if (lastDraft?.signature !== signature) lastDraft = { signature, operationId: crypto.randomUUID() };
    const draft = { kind: 'UNTRUSTED_REVIEW_DRAFT', synthetic: data.kind === 'synthetic', recordKey: selected.key,
      command: { operationId: lastDraft.operationId, expectedSourceFingerprint: selected.sourceFingerprint,
        field: field.name, proposedValue, reason,
        evidenceRefs: format ? [] : [{ ref: byId('evidence').value, sha256: byId('evidence-sha').value }] },
      applied: false, operationalAuthorized: false };
    const url = URL.createObjectURL(new Blob([JSON.stringify(draft, null, 2)], { type: 'application/json' }));
    const download = document.createElement('a'); download.href = url; download.download = 'revisao-proposta-pendente.json'; download.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    byId('message').textContent = 'Proposta preparada. Autorizacao, auditoria canonica e revalidacao continuam pendentes; nenhum cadastro alterado.';
  });
  render();
}

export function renderAssistedReview(records, { kind = 'private' } = {}) {
  if (!Array.isArray(records) || !['private', 'synthetic'].includes(kind)) throw new Error('REVIEW_RENDER_CONTRACT_REQUIRED');
  if (kind === 'synthetic' && records.some(record => record.synthetic !== true || record.provenance?.sourceSystem !== 'SYNTHETIC'))
    throw new Error('PRIVATE_DATA_PUBLIC_PREVIEW_DENIED');
  const nonce = randomBytes(24).toString('base64');
  const visible = records.map(record => ({ ...record, fields: record.fields.map(field => {
    if (!field.protected || record.actions.viewProtected) return field;
    const { original, normalization, ...metadata } = field;
    return { ...metadata, normalization: { proposed: null, rule: null } };
  }) }));
  const serialized = JSON.stringify(protectReviewValue({ kind, records: visible })).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; connect-src 'none'; base-uri 'none'; form-action 'none'">
<title>Revisao assistida do legado</title><style nonce="${nonce}">
*{box-sizing:border-box}body{margin:0;background:#f1f8fc;color:#17252d;font:14px system-ui;letter-spacing:0}main{max-width:1360px;margin:auto;padding:20px}h1{font-size:23px;margin:0}h2{font-size:18px}header{border-bottom:1px solid #b9d6e6;padding:14px 0}p{overflow-wrap:anywhere}.mode{color:#8a3c13}.counts,.filters{display:flex;gap:16px;flex-wrap:wrap;margin:18px 0}.counts span{border-left:3px solid #208474;padding-left:10px}.filters label{display:flex;flex-direction:column;gap:5px;min-width:150px}input,select,textarea,button{font:inherit;min-height:36px;border:1px solid #9eb9c8;border-radius:4px;padding:7px;background:white;color:inherit;max-width:100%}input[type=search]{width:280px}button{cursor:pointer;background:#e6f3fc}button:disabled{cursor:not-allowed;color:#687981;background:#edf0f2}table{border-collapse:collapse;width:100%;background:white;table-layout:fixed}th,td{text-align:left;padding:9px;border-bottom:1px solid #d8e4eb;overflow-wrap:anywhere;vertical-align:top}th{background:#e4f1fa}th:last-child{width:110px}.scroll{overflow-x:auto}nav{display:flex;align-items:center;gap:12px;margin:12px 0}.detail{border-top:2px solid #71aaca;margin-top:22px;padding-top:12px}.form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.form label{display:flex;flex-direction:column;gap:5px}.form .wide{grid-column:1/-1}textarea{resize:vertical;min-height:70px}#message{min-height:42px;color:#5d3612}@media(max-width:650px){main{padding:12px}.form{grid-template-columns:1fr}.form .wide{grid-column:auto}.scroll table{min-width:700px}.filters label,input[type=search]{width:100%}.counts{gap:12px}}
</style></head><body><main><header><h1>Revisao assistida do legado</h1><p class="mode">${kind === 'synthetic' ? 'PREVIA SINTETICA' : 'REVISAO PRIVADA'} — sem aplicacao ou liberacao operacional</p></header>
<section class="counts" aria-label="Contagens da fonte completa"><span>Total: <strong id="total"></strong></span><span>Validado: <strong id="count-VALIDATED_ELIGIBLE"></strong></span><span>Pendencia nao critica: <strong id="count-IMPORTED_PENDING"></strong></span><span>Revisao: <strong id="count-REVIEW_REQUIRED"></strong></span><span>Historico: <strong id="count-HISTORY_ONLY"></strong></span></section>
<div class="filters"><label>Situacao<select id="situation"><option value="">Todas</option></select></label><label>Entidade<select id="entity"><option value="">Todas</option></select></label><label>Codigo, referencia ou motivo<input id="search" type="search" maxlength="100"></label></div>
<p>Selecionados: <strong id="matched"></strong></p><div class="scroll"><table><thead><tr><th>Entidade</th><th>Codigo de origem</th><th>Situacao textual</th><th>Motivos por campo</th><th>Acao</th></tr></thead><tbody id="rows"></tbody></table></div><p id="empty" hidden>Nenhum registro corresponde aos filtros.</p>
<nav aria-label="Paginas"><button id="previous" type="button">Anterior</button><span id="page"></span><button id="next" type="button">Proxima</button></nav>
<section id="detail" class="detail" hidden><h2 id="selected"></h2><p id="status-detail"></p><p id="provenance"></p><p>Operacoes bloqueadas: <span id="blocked"></span></p>
<div class="scroll"><table><thead><tr><th>Campo</th><th>Valor original</th><th>Sugestao de formato</th><th>Motivo</th></tr></thead><tbody id="fields"></tbody></table></div>
<h2>Proposta de revisao</h2><div class="form"><label>Campo<select id="field"></select></label><label>Valor proposto<input id="proposed" maxlength="500"></label><label class="wide">Justificativa<textarea id="reason" maxlength="500"></textarea></label><label>Referencia de evidencia<input id="evidence" maxlength="120"></label><label>SHA-256 da evidencia<input id="evidence-sha" maxlength="64"></label></div>
<nav><button id="normalization" type="button">Usar sugestao de formato</button><button id="prepare" type="button">Baixar proposta pendente</button><button type="button" disabled title="Exige autorizacao e revalidacao no servico canonico">Aplicar no cadastro</button></nav><p id="message" role="status"></p></section>
</main><script id="review-data" type="application/json" nonce="${nonce}">${serialized}</script><script nonce="${nonce}">(${reviewBrowserRuntime.toString()})();</script></body></html>`;
}
