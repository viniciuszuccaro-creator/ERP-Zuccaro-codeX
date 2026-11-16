const fields = {
  GrupoEmpresarial: { nome: 'nome_do_grupo', descricao: 'observacoes', cnpj: 'cnpj_grupo' },
  Empresa: { razao_social: 'razao_social', nome_fantasia: 'nome_fantasia', cnpj: 'cnpj' },
};

export function hydrateOrganizacional(kind, row) {
  if (!row?.id || !/^[a-f0-9]{64}$/.test(row.version || '') || !Array.isArray(row.supported_fields)) {
    throw new Error('Leitura organizacional incompleta. Reabra o cadastro.');
  }
  return kind === 'GrupoEmpresarial' ? { ...row, nome: row.nome_do_grupo,
    descricao: row.observacoes, cnpj: row.cnpj_grupo, empresas_ids: row.empresas_ids || [] } : row;
}

/** Only changed supported fields: absent values never erase server data. */
export function buildOrganizacionalPatch(kind, before, draft) {
  hydrateOrganizacional(kind, before);
  if (draft.id && draft.id !== before.id) throw new Error('ID imutavel.');
  if (draft.group_id && draft.group_id !== before.group_id) throw new Error('Grupo imutavel.');
  const patch = { expected_version: before.version };
  for (const [ui, column] of Object.entries(fields[kind] || {})) {
    if (!Object.hasOwn(draft, ui)) continue;
    let value = draft[ui];
    if (value === before[ui] || (value === '' && before[ui] == null)) continue;
    if (!before.supported_fields.includes(column)) throw new Error('Campo sem persistencia neste contrato.');
    if (ui === 'cnpj') value = value ? String(value).replace(/\D/g, '') : null;
    patch[column] = value === '' && ui !== 'nome' && ui !== 'razao_social' ? null : value;
  }
  return patch;
}

function matches(row, query) {
  return Object.entries(query || {}).every(([key, value]) => {
    if (key === '$or' || key === '$and') {
      if (!Array.isArray(value)) throw new Error('Filtro organizacional invalido.');
      return key === '$or' ? value.some(q => matches(row, q)) : value.every(q => matches(row, q));
    }
    if (key === 'grupo_id') return row.group_id === value;
    if (value && typeof value === 'object') {
      if (Object.keys(value).length === 1 && typeof value.$regex === 'string') {
        return String(row[key] || '').toLocaleLowerCase().includes(value.$regex.toLocaleLowerCase());
      }
      throw new Error('Operador organizacional nao suportado.');
    }
    return row[key] === value;
  });
}

/** Uses the existing HTTP request owner; no mirror fallback or independent store. */
export function createOrganizacionalHttp(kind, request) {
  const path = kind === 'Empresa' ? '/api/v1/empresas' : '/api/v1/grupos-empresariais';
  const all = async () => {
    const result = await request(path, { unwrap: false });
    if (!Array.isArray(result?.data) || result?.meta?.total !== result.data.length) throw new Error('Lista organizacional parcial ou invalida.');
    return result.data.map(r => hydrateOrganizacional(kind, r));
  };
  return {
    list: () => all(),
    async filter(query = {}, _order, limit = 100, skip = 0) { return (await all()).filter(r => matches(r, query)).slice(skip, skip + limit); },
    async count(query = {}) { return (await all()).filter(r => matches(r, query)).length; },
    async get(id) { return hydrateOrganizacional(kind, await request(`${path}/${encodeURIComponent(id)}`)); },
    async update(id, payload) { return hydrateOrganizacional(kind, await request(`${path}/${encodeURIComponent(id)}`, { method: 'PATCH', body: payload })); },
    async create() { throw new Error('Criacao organizacional ainda nao habilitada neste contrato.'); },
    async delete() { throw new Error('Inativacao organizacional exige fluxo especifico.'); },
  };
}
