/**
 * Resolução fail-closed de Condição de Pagamento (Onda 2 / R08A).
 * Ordem canônica: específica ClienteEmpresa ativa/autorizada → padrão ativo da Empresa → null.
 * Sem fallback implícito de Grupo.
 */

export type CondicaoResolucaoParcela = {
  ordem: number;
  dias: number;
  percentual: string;
  ativo?: boolean;
};

export type CondicaoResolucaoRow = {
  id: string;
  codigo: string;
  nome: string;
  ativo: boolean;
  parcelas: CondicaoResolucaoParcela[];
};

export type CondicaoResolucaoFonte = 'cliente_empresa' | 'empresa_padrao' | 'nenhuma';

export type CondicaoResolucaoResultado = {
  fonte: CondicaoResolucaoFonte;
  condicao: CondicaoResolucaoRow | null;
};

/** Preferência do vínculo Cliente×Empresa só vale se a condição estiver ativa e no escopo. */
export function escolherCondicaoResolvida(options: {
  preferida: CondicaoResolucaoRow | null | undefined;
  padraoEmpresa: CondicaoResolucaoRow | null | undefined;
}): CondicaoResolucaoResultado {
  if (options.preferida?.ativo) {
    return { fonte: 'cliente_empresa', condicao: options.preferida };
  }
  if (options.padraoEmpresa?.ativo) {
    return { fonte: 'empresa_padrao', condicao: options.padraoEmpresa };
  }
  return { fonte: 'nenhuma', condicao: null };
}

export function snapshotCondicaoParaDocumento(condicao: CondicaoResolucaoRow | null | undefined) {
  if (!condicao?.ativo) return null;
  const parcelas = (condicao.parcelas ?? [])
    .filter((p) => p?.ativo !== false)
    .slice()
    .sort((a, b) => a.ordem - b.ordem)
    .map((p) => ({
      ordem: p.ordem,
      dias: p.dias,
      percentual: String(p.percentual),
    }));
  return {
    id: condicao.id,
    codigo: condicao.codigo,
    nome: condicao.nome,
    parcelas,
  };
}
