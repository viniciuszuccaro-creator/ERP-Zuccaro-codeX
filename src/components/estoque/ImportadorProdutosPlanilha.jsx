import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Upload, Loader2, CheckCircle2, Download, AlertCircle, Wand2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Helpers
const num = (v) => {
  if (v == null || v === "") return undefined;
  const n = Number(String(v).replace(/\./g, "").replace(/,/g, "."));
  return Number.isFinite(n) ? n : undefined;
};

const sanitize = (v) => {
  if (v == null) return undefined;
  const s = String(v).trim();
  return s === "" ? undefined : s;
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const removeDiacritics = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const get = (row, keys) => {
  const normKey = (s) => removeDiacritics(String(s || '').toLowerCase().trim().replace(/^\uFEFF/, ''));
  const tryReturn = (key) => (key != null && row[key] != null && row[key] !== '') ? row[key] : undefined;
  const rowKeys = Object.keys(row || {});
  const rowKeysNorm = rowKeys.map((rk) => ({ raw: rk, norm: normKey(rk) }));

  for (const k of keys) {
    if (!k) continue;
    // 1) direto e variações simples
    const direct = tryReturn(k); if (direct !== undefined) return direct;
    const upper = tryReturn(String(k).toUpperCase()); if (upper !== undefined) return upper;

    // 2) comparações normalizadas
    const target = normKey(k);
    const eq = rowKeysNorm.find((rk) => rk.norm === target);
    if (eq) { const v = tryReturn(eq.raw); if (v !== undefined) return v; }

    // 3) fuzzy: inclui o alvo dentro do cabeçalho normalizado (ex.: "descr" casa com "descricao do produto")
    if (target.length >= 4) {
      const incl = rowKeysNorm.find((rk) => rk.norm.includes(target));
      if (incl) { const v = tryReturn(incl.raw); if (v !== undefined) return v; }
    }
  }
  return undefined;
};

// Normalização e detecção da linha de cabeçalho
const norm = (s) => String(s || "").normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
// Após converter a planilha em objetos, não há linha de cabeçalho nas linhas retornadas.
// Para evitar falsos positivos (ex.: valores "UN"/"KG" sendo confundidos com cabeçalho), sempre retornamos false.
const isHeaderRow = () => false; // nunca descarta linhas de dados

// Mapeamento fixo conforme especificação do usuário (linha 1 = cabeçalhos, dados a partir da linha 2)
const HEADERS = {
  codigo: [
    "Cód. Material", "Cod. Material", "Código", "Codigo", "Código Material", "Codigo Material",
    "SKU", "Código Interno", "Codigo Interno", "A"
  ],
  descricao: [
    "Descrição", "Descricao", "Descrição Produto", "Descricao Produto", "Descrição do Produto", "Descricao do Produto",
    "Descrição do Material", "Descricao do Material", "Descrição Material", "Descricao Material",
    "Produto", "Nome", "Nome do Produto", "Item", "B"
  ],
  unidade_medida: [
    "Un.", "UN", "Un", "Unidade", "Unid.", "Unid", "Unidade de Medida", "Unidade Medida",
    "UNIDADE", "UM", "UNI", "UND", "C"
  ],
  estoque_minimo: ["Estoque Minimo", "Estoque Mínimo", "Estoque Mínimo (Qtd)", "D"],
  ncm: ["Classif. Fiscal", "NCM", "Classificação Fiscal", "Classificacao Fiscal", "E"],
  peso_teorico_kg_m: ["Peso Teórico", "Peso Teorico", "Peso Teorico KG/M", "F"],
  grupo_produto_id: ["Codigo da Classe", "Código da Classe", "Código do Grupo de Produto", "ID Grupo Produto", "G"],
  grupo_produto_nome: ["Descrição da Classe", "Descricao da Classe", "Grupo do Produto", "Grupo Produto", "H"],
  peso_liquido_kg: ["Peso Liquido", "Peso Líquido", "I"],
  peso_bruto_kg: ["Peso Bruto", "J"],
  setor_atividade_id: ["Codigo do Grupo", "Código do Grupo", "ID Setor Atividade", "K"],
  setor_atividade_nome: ["Descrição do Grupo", "Descricao do Grupo", "Setor de Atividade", "L"],
  custo_aquisicao: ["Custo Principal", "Custo", "Preço de Custo", "Preco de Custo", "M"],
  tipo_item: ["Descrição Tipo", "Descricao Tipo", "Tipo do Item", "Tipo", "N"],
};

// Labels amigáveis por campo
const FIELD_LABELS = {
  codigo: 'Código',
  descricao: 'Descrição',
  unidade_medida: 'Unidade',
  estoque_minimo: 'Estoque Mínimo',
  ncm: 'NCM',
  peso_teorico_kg_m: 'Peso Teórico KG/M',
  grupo_produto_id: 'ID Grupo Produto',
  grupo_produto_nome: 'Grupo Produto Nome',
  peso_liquido_kg: 'Peso Líquido KG',
  peso_bruto_kg: 'Peso Bruto KG',
  setor_atividade_id: 'ID Setor Atividade',
  setor_atividade_nome: 'Setor Atividade Nome',
  custo_aquisicao: 'Custo Aquisição',
  tipo_item: 'Tipo Item',
};

// Auto-mapeamento: sugere cabeçalhos para cada campo a partir da lista disponível
const autoMapFromHeaders = (headers = []) => {
  const n = (s) => norm(s).replace(/^\uFEFF/, '');
  const headersNorm = headers.map((h) => ({ raw: h, norm: n(String(h || '')) }));
  const result = {};
  Object.keys(HEADERS).forEach((field) => {
    const syns = HEADERS[field] || [];
    let found = '';
    for (const syn of syns) {
      const target = n(String(syn));
      const eq = headersNorm.find((h) => h.norm === target);
      if (eq) { found = eq.raw; break; }
      if (target.length >= 3) {
        const incl = headersNorm.find((h) => h.norm.includes(target));
        if (incl) { found = incl.raw; break; }
      }
    }
    result[field] = found;
  });
  // Fallback por posição (template A..N)
  const has = (k) => headers.includes(k);
  if (!result.codigo && has('A')) result.codigo = 'A';
  if (!result.descricao && has('B')) result.descricao = 'B';
  if (!result.unidade_medida && has('C')) result.unidade_medida = 'C';
  return result;
};


// Normalizadores para evitar 422 (enum inválido)
const mapUnidade = (v) => {
  const s = norm(v || '').replace(/\./g, '');
  switch (s) {
    case 'un': case 'und': case 'unid': case 'um': case 'uni': return 'UN';
    case 'pc': case 'pç': case 'peca': case 'pec': case 'peça': return 'PC';
    case 'kg': case 'kilo': return 'KG';
    case 'lt': case 'l': return 'LT';
    case 'mt': case 'm': return 'MT';
    case 'cx': case 'caixa': return 'CX';
    case 'm2': case 'm²': return 'M2';
    case 'm3': case 'm³': return 'M3';
    default: return undefined;
  }
};
const mapTipoItem = (v) => {
        const s = norm(v || '');
        if (s.includes('rev')) return 'Revenda';
        if (s.includes('mater') || s.includes('prima')) return 'Matéria-Prima Produção';
        if (s.includes('acab')) return 'Produto Acabado';
        if (s.includes('consum')) return 'Consumo Interno';
        if (s.includes('serv')) return 'Serviço';
        return 'Revenda';
      };

      // Validações adicionais
      const UNIDADES_ACEITAS = ['UN','PC','KG','LT','MT','CX','M2','M3'];
      const sanitizeNCM = (v) => {
        const s = String(v || '').replace(/\./g, '').trim();
        return s || undefined;
      };
      const isNCMValido = (v) => {
        const s = String(v || '').replace(/\./g, '').trim();
        return s === '' || /^\d{8}$/.test(s);
      };
      const makeKey = (empresaId, codigo) => `${empresaId || ''}__${String(codigo || '').toUpperCase()}`;

export default function ImportadorProdutosPlanilha({ onConcluido, closeSelf }) {
  const { empresaAtual, grupoAtual, contexto, filterInContext, createInContext, updateInContext, deleteInContext } = useContextoVisual();
  const { hasPermission } = usePermissions();
  const [arquivo, setArquivo] = useState(null);
  const [processando, setProcessando] = useState(false);
  const [preview, setPreview] = useState([]);
  const [fileUrl, setFileUrl] = useState(null);
  const [columnMap, setColumnMap] = useState({}); // {campoERP: headerPlanilha}
  const [availableHeaders, setAvailableHeaders] = useState([]);
  const [parsedRows, setParsedRows] = useState([]);
  const [totalLinhas, setTotalLinhas] = useState(0);
  const [erro, setErro] = useState('');
  const [grupoId, setGrupoId] = useState('');
  const [empresaId, setEmpresaId] = useState(empresaAtual?.id || '');
const [importarParaTodasEmpresas, setImportarParaTodasEmpresas] = useState(false);
const [baseProdutos, setBaseProdutos] = useState([]);
const [validationErrors, setValidationErrors] = useState([]); // {empresa_id, codigo, motivo}
const [duplicidades, setDuplicidades] = useState([]); // {empresa_id, codigo, existente, novo}
const [escolhasDuplicidades, setEscolhasDuplicidades] = useState({}); // key -> 'atualizar' | 'pular' | 'substituir'
const [checando, setChecando] = useState(false);
const [estrategiaDuplicidadeGlobal, setEstrategiaDuplicidadeGlobal] = useState('pular'); // 'pular' | 'atualizar' | 'substituir'
const [invalidNCMKeys, setInvalidNCMKeys] = useState(new Set());
const [ncmSuggestions, setNcmSuggestions] = useState({});
const [suggesting, setSuggesting] = useState(false);
  const contextoGrupoId = grupoId || grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || empresaAtual?.groupId || null;
  const contextoEmpresaId = empresaId || empresaAtual?.id || null;
  const hasDestinoImportacao = !!(empresaId || grupoId);
  const canImportarProdutos = hasPermission('Estoque', 'Produtos', 'criar') ||
    hasPermission('Estoque', 'Produtos', 'editar') ||
    hasPermission('Cadastros', 'Produto', 'criar') ||
    hasPermission('Cadastros', 'Produto', 'editar') ||
    hasPermission('Estoque', null, 'criar') ||
    hasPermission('Cadastros', null, 'criar');

  const withProdutoContexto = (payload = {}, produtoBase = {}) => ({
    ...payload,
    empresa_id: produtoBase.empresa_id || payload.empresa_id || empresaId || empresaAtual?.id || null,
    group_id: produtoBase.group_id || payload.group_id || contextoGrupoId || null,
  });

  const auditImportadorProdutos = async ({ acao, sucesso = true, motivo = null, dados = {} }) => {
    try {
      await createInContext('AuditLog', {
        acao,
        modulo: 'Estoque',
        entidade: 'Produto',
        tipo_auditoria: sucesso ? 'entidade' : 'seguranca',
        descricao: motivo || 'Auditoria de importacao de produtos por planilha.',
        group_id: contextoGrupoId || dados.group_id || null,
        grupo_id: contextoGrupoId || dados.group_id || null,
        empresa_id: contextoEmpresaId || dados.empresa_id || null,
        dados_anteriores: dados.dados_anteriores || null,
        dados_novos: {
          ...dados,
          contexto,
          arquivo: arquivo?.name || dados.arquivo || null,
        },
        sucesso,
        data_hora: new Date().toISOString(),
      });
    } catch (error) {
      console.warn('Falha ao auditar importacao de produtos:', error);
    }
  };
  const { data: grupos = [] } = useQuery({
    queryKey: ['grupos-empresariais'],
    queryFn: () => base44.entities.GrupoEmpresarial.list(),
    staleTime: 300000,
  });
  const { data: empresas = [] } = useQuery({
    queryKey: ['empresas-por-grupo', grupoId],
    queryFn: async () => {
      // Garantir que o grupo selecionado existe e recarregar quando trocar
      if (!grupoId) return base44.entities.Empresa.list();
      // Alguns clientes usam campos diferentes (group_id vs grupo_id)
      const [byGroup, byGrupo, byGroupExact] = await Promise.all([
        base44.entities.Empresa.filter({ group_id: grupoId }),
        base44.entities.Empresa.filter({ grupo_id: grupoId }),
        base44.entities.Empresa.filter({ groupId: grupoId }),
      ]);
      const merged = [...(byGroup || []), ...(byGrupo || []), ...(byGroupExact || [])];
      // dedup por id
      const map = new Map();
      merged.forEach(e => { if (e?.id) map.set(e.id, e); });
      const arr = Array.from(map.values());
      return arr.length ? arr : [];
    },
    staleTime: 60000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  // Mapas para Grupo de Produto e Setor de Atividade (carregar do ERP)
  const { data: gruposProduto = [] } = useQuery({
    queryKey: ['grupos-produto'],
    queryFn: () => filterInContext('GrupoProduto', {}, 'nome_grupo', 500),
    staleTime: 300000,
  });
  const { data: setoresAtividade = [] } = useQuery({
    queryKey: ['setores-atividade'],
    queryFn: () => filterInContext('SetorAtividade', {}, 'nome', 500),
    staleTime: 300000,
  });
  const gruposByCodigo = React.useMemo(() => {
    const m = {};
    (gruposProduto || []).forEach(g => {
      if (g?.codigo != null) m[String(g.codigo).trim()] = g.id;
    });
    return m;
  }, [gruposProduto]);
  const gruposByNome = React.useMemo(() => {
    const m = {};
    (gruposProduto || []).forEach(g => {
      const n = g?.nome_grupo || g?.nome;
      if (n) m[norm(n)] = g.id;
    });
    return m;
  }, [gruposProduto]);
  const setoresByCodigo = React.useMemo(() => {
    const m = {};
    (setoresAtividade || []).forEach(s => {
      if (s?.codigo != null) m[String(s.codigo).trim()] = s.id;
    });
    return m;
  }, [setoresAtividade]);
  const setoresByNome = React.useMemo(() => {
    const m = {};
    (setoresAtividade || []).forEach(s => {
      const n = s?.nome || s?.descricao || s?.nome_setor;
      if (n) m[norm(n)] = s.id;
    });
    return m;
  }, [setoresAtividade]);

  // Runtime maps to include entities created during import
  let runtimeGruposByCodigo = {};
  let runtimeGruposByNome = {};
  let runtimeSetoresByNome = {};

  // Opções de grupos: usa GrupoEmpresarial quando disponível; caso contrário, deriva dos group_id das empresas
  const groupsOptions = React.useMemo(() => {
    if (Array.isArray(grupos) && grupos.length > 0) return grupos;
    const ids = new Set();
    (empresas || []).forEach(e => {
      if (e?.group_id) ids.add(e.group_id);
      if (e?.grupo_id) ids.add(e.grupo_id);
      if (e?.groupId) ids.add(e.groupId);
    });
    return Array.from(ids).map(id => ({ id, nome: id }));
  }, [grupos, empresas]);



  React.useEffect(() => {
    if (!empresaId && empresaAtual?.id) {
      setEmpresaId(empresaAtual.id);
    } else if (!empresaId && empresas?.length > 0) {
      setEmpresaId(empresas[0].id);
    }
  }, [empresaAtual?.id, empresas?.length, empresaId]);

  // Calcula a lista de produtos alvo (considerando importação por grupo)
  const getProdutosAlvo = () => {
    if (!baseProdutos?.length) return [];
    if ((importarParaTodasEmpresas && grupoId && empresas?.length) || (!empresaId && grupoId && empresas?.length)) {
      return empresas.flatMap(emp => baseProdutos.map(p => ({ ...p, empresa_id: emp.id, group_id: grupoId, compartilhado_grupo: true })));
    }
    return baseProdutos;
  };

  const downloadErrosCSV = () => {
    if (!validationErrors.length) return;
    const headers = ['empresa_id','codigo','motivo'];
    const rows = validationErrors.map(e => [e.empresa_id || '', e.codigo || '', e.motivo || '']);
    const csv = [headers.join(','), ...rows.map(r => r.map(x => `"${String(x).replace(/"/g,'"')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'erros_importacao_produtos.csv';
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
    a.remove();
  };

  // Sugestão de NCM via IA
  const sugerirNCMsIA = async () => {
    try {
      setSuggesting(true);
      const produtosAlvo = getProdutosAlvo();
      const alvos = produtosAlvo.filter(p => invalidNCMKeys.has(makeKey(p.empresa_id, p.codigo)));
      if (alvos.length === 0) {
        toast('Nenhum item pendente de NCM');
        setSuggesting(false);
        return;
      }
      const itens = alvos.map(p => ({
        chave: makeKey(p.empresa_id, p.codigo),
        codigo: p.codigo,
        descricao: p.descricao,
        grupo: p.grupo_produto_nome || p.grupo_produto_id || '',
        setor: p.setor_atividade_nome || p.setor_atividade_id || '',
        ncm_atual: p.ncm || ''
      }));
      const prompt = [
        'Você é um especialista fiscal brasileiro. Para cada item, sugira o NCM de 8 dígitos mais apropriado.',
        'Considere apenas regras gerais (sem estado específico).',
        'Responda estritamente no JSON do schema.',
        'Itens:', JSON.stringify(itens, null, 2)
      ].join('\n');
      const res = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: 'object',
          properties: {
            sugestoes: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  chave: { type: 'string' },
                  ncm_sugerido: { type: 'string' },
                  confianca: { type: 'number' },
                  justificativa: { type: 'string' }
                },
                required: ['chave', 'ncm_sugerido']
              }
            }
          },
          required: ['sugestoes']
        }
      });
      const sugestoes = Array.isArray(res?.sugestoes) ? res.sugestoes : [];
      const map = {};
      sugestoes.forEach(s => {
        const ncm = String(s.ncm_sugerido || '').replace(/\D/g, '').slice(0, 8);
        if (ncm && ncm.length === 8) map[s.chave] = ncm;
      });
      setNcmSuggestions(map);
      toast.success(`Sugestões geradas para ${Object.keys(map).length} itens`);
    } catch (e) {
      toast.error(e?.message || 'Falha ao sugerir NCMs');
    } finally {
      setSuggesting(false);
    }
  };
  const applySuggestion = (key) => {
    const ncm = ncmSuggestions[key];
    if (!ncm) return;
    setBaseProdutos(prev => prev.map(p => (makeKey(p.empresa_id, p.codigo) === key ? { ...p, ncm } : p)));
    setPreview(prev => prev.map(p => (makeKey(p.empresa_id, p.codigo) === key ? { ...p, ncm } : p)));
  };
  const applyAllSuggestions = () => {
    const keys = Object.keys(ncmSuggestions || {});
    if (keys.length === 0) return;
    setBaseProdutos(prev => prev.map(p => {
      const k = makeKey(p.empresa_id, p.codigo);
      return ncmSuggestions[k] ? { ...p, ncm: ncmSuggestions[k] } : p;
    }));
    setPreview(prev => prev.map(p => {
      const k = makeKey(p.empresa_id, p.codigo);
      return ncmSuggestions[k] ? { ...p, ncm: ncmSuggestions[k] } : p;
    }));
  };

  // Validação e checagem de duplicidade no banco
  React.useEffect(() => {
    const validar = async () => {
      if (!baseProdutos?.length) { setValidationErrors([]); setDuplicidades([]); setEscolhasDuplicidades({}); return; }
      const produtosAlvo = getProdutosAlvo();
      setChecando(true);
      setValidationErrors([]);
      setDuplicidades([]);
      setEscolhasDuplicidades({});

      const erros = [];
      const internos = new Set();
      const vistos = new Set();
      for (const p of produtosAlvo) {
        const k = makeKey(p.empresa_id, p.codigo);
        if (!p?.codigo) erros.push({ empresa_id: p.empresa_id, codigo: '-', motivo: 'Código ausente' });
        if (!p?.descricao || String(p.descricao).trim() === '') erros.push({ empresa_id: p.empresa_id, codigo: p.codigo, motivo: 'Descrição obrigatória ausente' });
        if (!UNIDADES_ACEITAS.includes(p.unidade_medida)) erros.push({ empresa_id: p.empresa_id, codigo: p.codigo, motivo: 'Unidade de medida ausente ou inválida' });
        if (p?.grupo_produto_nome && !p?.grupo_produto_id) erros.push({ empresa_id: p.empresa_id, codigo: p.codigo, motivo: `Grupo de produto não encontrado: ${p.grupo_produto_nome}` });
        /* NCM inválido não bloqueia importação; será sugerido por IA */
        if (vistos.has(k)) internos.add(k); else vistos.add(k);
      }
      // Duplicidades internas na planilha
      if (internos.size) {
        internos.forEach(k => {
          const [empId, code] = k.split('__');
          erros.push({ empresa_id: empId, codigo: code, motivo: 'Código duplicado na empresa (na planilha)' });
        });
      }

      // Marcar NCMs ausentes ou inválidos para sugestão por IA (não bloqueia)
      const invalids = new Set();
      for (const p of produtosAlvo) {
        const k = makeKey(p.empresa_id, p.codigo);
        const invalido = !p?.ncm || !isNCMValido(p.ncm);
        if (invalido) invalids.add(k);
      }
      setInvalidNCMKeys(invalids);

      // Checagem no banco por empresa+codigo
      const keys = Array.from(new Set(produtosAlvo
        .filter(p => p.codigo)
        .map(p => makeKey(p.empresa_id, p.codigo))));

      const duplics = [];
      const chunk = 10; // reduzir concorrência para evitar rate limit (mais conservador)
      let delayDup = 0;
      for (let i = 0; i < keys.length; i += chunk) {
        const slice = keys.slice(i, i + chunk);
        if (delayDup) await sleep(delayDup);
        const results = await Promise.allSettled(slice.map(async (k) => {
          const [empId, code] = k.split('__');
          if (internos.has(k)) return null;
          try {
            const encontrados = await filterInContext('Produto', { empresa_id: empId, codigo: code }, undefined, 1);
            if (Array.isArray(encontrados) && encontrados.length > 0) {
              const novo = produtosAlvo.find(p => makeKey(p.empresa_id, p.codigo) === k);
              duplics.push({ empresa_id: empId, codigo: code, existente: encontrados[0], novo });
            }
          } catch (err) {
            const msg = String(err?.message || '').toLowerCase();
            if (msg.includes('rate limit')) {
              await sleep(500);
              const encontrados = await filterInContext('Produto', { empresa_id: empId, codigo: code }, undefined, 1);
              if (Array.isArray(encontrados) && encontrados.length > 0) {
                const novo = produtosAlvo.find(p => makeKey(p.empresa_id, p.codigo) === k);
                duplics.push({ empresa_id: empId, codigo: code, existente: encontrados[0], novo });
              }
            }
          }
          return null;
        }));
        if (results.some(r => r.status === 'rejected' && String(r.reason?.message || '').toLowerCase().includes('rate limit'))) {
          delayDup = Math.min((delayDup || 400) * 1.5, 5000);
        }
        await sleep(250);
      }
      setValidationErrors(erros);
      setDuplicidades(duplics);
      setChecando(false);
    };
    validar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseProdutos, empresaId, grupoId, importarParaTodasEmpresas, empresas?.length]);

  const detectEncoding = async (file) => {
    try {
      const buf = await file.slice(0, 4).arrayBuffer();
      const b = new Uint8Array(buf);
      if (b[0] === 0xFF && b[1] === 0xFE) return 'UTF-16LE';
      if (b[0] === 0xFE && b[1] === 0xFF) return 'UTF-16BE';
      if (b[0] === 0xEF && b[1] === 0xBB && b[2] === 0xBF) return 'UTF-8';
    } catch (_) {}
    return 'UTF-8';
  };

  // CSV parser com suporte a BOM e linha "sep=;"/"sep=,"
  const parseCSVRows = (raw) => {
    let text = String(raw || '');
    // remove BOM
    text = text.replace(/^\uFEFF/, '');

    // checa diretiva de separador do Excel (primeira linha: sep=; ou sep=,)
    let sepDirective = null;
    const firstBreak = (() => {
      const n = text.indexOf('\n');
      const r = text.indexOf('\r');
      if (n === -1 && r === -1) return -1;
      if (n === -1) return r;
      if (r === -1) return n;
      return Math.min(n, r);
    })();
    if (firstBreak > -1) {
      const firstLine = text.slice(0, firstBreak).trim();
      const m = /^sep=(.|\t)$/i.exec(firstLine);
      if (m) {
        sepDirective = m[1] === 't' ? '\t' : m[1];
        // remove a linha de diretiva do conteúdo antes de parsear
        text = text.slice(firstBreak + 1);
      }
    }

    // detectar delimitador ("," ";" ou tab) na primeira linha útil
    const detectDelim = (line) => {
      // prioridade: diretiva explícita
      if (sepDirective) return sepDirective;

      // atalho seguro: tabulação explícita na linha
      if (line.includes('\t')) return '\t';

      // fallback heurístico simples
      const simpleCounts = {
        ',': (line.match(/,/g) || []).length,
        ';': (line.match(/;/g) || []).length,
      };
      if (simpleCounts[';'] > simpleCounts[',']) return ';'
      if (simpleCounts[','] > simpleCounts[';']) return ',';

      // varredura ignorando aspas
      const cand = [',', ';', '\t'];
      const counts = { ',': 0, ';': 0, '\t': 0 };
      let inQ = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        const next = line[i + 1];
        if (inQ) {
          if (ch === '"' && next === '"') { i++; continue; }
          if (ch === '"') { inQ = false; continue; }
        } else {
          if (ch === '"') { inQ = true; continue; }
          if (ch === '\t') counts['\t']++;
          else if (ch === ',') counts[',']++;
          else if (ch === ';') counts[';']++;
          if (ch === '\n' || ch === '\r') break;
        }
      }
      const best = cand.reduce((a, b) => (counts[a] >= counts[b] ? a : b));
      return counts[best] > 0 ? best : ';';
    };

    const firstLineEnd = (() => {
      const n = text.indexOf('\n');
      const r = text.indexOf('\r');
      if (n === -1 && r === -1) return text.length;
      if (n === -1) return r;
      if (r === -1) return n;
      return Math.min(n, r);
    })();
    const delim = detectDelim(text.slice(0, firstLineEnd));

    const rows = [];
    let row = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      const next = text[i + 1];
      if (inQuotes) {
        if (ch === '"' && next === '"') { cur += '"'; i++; continue; }
        if (ch === '"') { inQuotes = false; continue; }
        cur += ch;
      } else {
        if (ch === '"') { inQuotes = true; continue; }
        if (ch === delim) { row.push(cur); cur = ''; continue; }
        if (ch === '\n' || ch === '\r') {
          if (ch === '\r' && next === '\n') i++; // CRLF
          row.push(cur); rows.push(row); row = []; cur = '';
          continue;
        }
        cur += ch;
      }
    }
    row.push(cur);
    rows.push(row);
    return rows.filter(r => r.some(c => String(c || '').trim() !== ''));
  };

  const extrairLinhas = async (file) => {
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setFileUrl(file_url);

    const ext = (file?.name || '').split('.').pop()?.toLowerCase();
    const encoding = await detectEncoding(file);

    // CSV: parse local para evitar problemas de encoding no servidor
    if (ext === 'csv') {
      const buf = await file.arrayBuffer();

      // primeira tentativa: usar encoding detectado
      const decodeWith = (enc) => {
        try { return new TextDecoder(enc).decode(buf); } catch { return null; }
      };

      let text = null;
      if (encoding === 'UTF-16LE' || encoding === 'UTF-16BE') {
        text = decodeWith(encoding === 'UTF-16LE' ? 'utf-16le' : 'utf-16be');
      } else {
        text = decodeWith('utf-8');
      }
      // heurística: se tiver muitos \u0000 ou �, tenta alternativas
      const hasNulls = text && /\u0000/.test(text);
      const manyReplacement = text && ((text.match(/\uFFFD/g)?.length) || 0) > 5;
      if (!text || hasNulls || manyReplacement) {
        text = decodeWith('utf-16le') || decodeWith('utf-16be') || decodeWith('iso-8859-1') || decodeWith('windows-1252') || text;
      }

      // 1) Parser local
      const rowsAA = parseCSVRows(text || '');
      if (Array.isArray(rowsAA) && rowsAA.length > 0) {
        const headerRowRaw = rowsAA[0].map((h) => String(h ?? '').replace(/^\uFEFF/, '').trim());
        const dataRows = rowsAA.slice(1);
        const maxLen = Math.max(headerRowRaw.length, ...dataRows.map(r => r.length, 0));
        let headerRow = headerRowRaw;
        const nonEmptyHeaders = headerRowRaw.filter(h => h && h.toString().trim().length > 0).length;
        if (nonEmptyHeaders === 0) {
          headerRow = Array.from({ length: maxLen }, (_, i) => `COL_${i + 1}`);
        } else if (headerRowRaw.length < maxLen) {
          headerRow = [
            ...headerRowRaw,
            ...Array.from({ length: maxLen - headerRowRaw.length }, (_, i) => `COL_${headerRowRaw.length + i + 1}`)
          ];
        }
        const objetos = dataRows.map((linha) => {
          const obj = {};
          for (let i = 0; i < maxLen; i++) {
            const val = linha[i];
            const header = headerRow[i];
            if (header) obj[header] = val;
            const letter = String.fromCharCode(65 + i); // A, B, C...
            obj[letter] = val;
          }
          return obj;
        });
        if (objetos.length > 0) return objetos.filter((o) => Object.keys(o).length > 0);
      }

      // 2) Fallback: extrator do Core tentando array de arrays
      try {
        const r = await base44.integrations.Core.ExtractDataFromUploadedFile({
          file_url: file_url,
          json_schema: { type: 'array', items: { type: 'array' } }
        });
        const arr = Array.isArray(r?.output) ? r.output : [];
        if (arr.length > 0 && Array.isArray(arr[0])) {
          const headerRow = arr[0].map((h) => String(h ?? '').trim());
          const dataRows = arr.slice(1);
          const maxLen = Math.max(headerRow.length, ...dataRows.map(r => r.length, 0));
          const objetos = dataRows.map((linha) => {
            const obj = {};
            for (let i = 0; i < maxLen; i++) {
              const val = linha[i];
              const header = headerRow[i] || `COL_${i+1}`;
              if (header) obj[header] = val;
              const letter = String.fromCharCode(65 + i);
              obj[letter] = val;
            }
            return obj;
          });
          if (objetos.length > 0) return objetos.filter((o) => Object.keys(o).length > 0);
        }
      } catch (_) {}

      // 3) Fallback final: extrair como objeto genérico e procurar arrays de objetos
      try {
        const r2 = await base44.integrations.Core.ExtractDataFromUploadedFile({
          file_url: file_url,
          json_schema: { type: 'object', additionalProperties: true }
        });
        const out = r2?.output || {};
        const pickArrayOfObjects = (obj) => {
          if (Array.isArray(obj) && obj.every((it) => typeof it === 'object' && !Array.isArray(it))) return obj;
          if (Array.isArray(obj?.rows)) return obj.rows;
          if (Array.isArray(obj?.data)) return obj.data;
          for (const val of Object.values(obj)) {
            if (Array.isArray(val) && val.every((it) => typeof it === 'object' && !Array.isArray(it))) return val;
          }
          return [];
        };
        const rows = pickArrayOfObjects(out);
        if (Array.isArray(rows) && rows.length) return rows;
      } catch (_) {}

      return [];
      }

    if (['xls','xlsx'].includes(ext)) {
      // se vier um CSV salvo como XLS/XLSX mal formatado, tente fallback para array de arrays
      try {
        const { data } = await base44.functions.invoke('parseSpreadsheet', { file_url });
        const rows = Array.isArray(data?.rows) ? data.rows : [];
        return rows;
      } catch (_) {}
    }
      const { data } = await base44.functions.invoke('parseSpreadsheet', { file_url });
      const rows = Array.isArray(data?.rows) ? data.rows : [];
      return rows;
    }



  // Usa columnMap para resolver sinônimos antes de buscar
  const getWithMap = (row, fieldKey) => {
    const mappedHeader = columnMap?.[fieldKey];
    const syns = HEADERS[fieldKey] || [];
    const candidates = mappedHeader ? [mappedHeader, ...syns] : syns;
    const val = get(row, candidates);
    if (val !== undefined) return val;
    // Fallback por posição padrão do template
    const pos = { codigo: 'A', descricao: 'B', unidade_medida: 'C' };
    const letter = pos[fieldKey];
    if (letter && row && Object.prototype.hasOwnProperty.call(row, letter)) {
      return row[letter];
    }
    return undefined;
  };

  const montarProduto = (row) => {
    // Resolver Grupo de Produto e Setor de Atividade a partir de ID/código ou nome
    const rawGrupoId = sanitize(getWithMap(row, 'grupo_produto_id'));
    const rawGrupoNome = sanitize(getWithMap(row, 'grupo_produto_nome'));
    const gruposCodigoMap = { ...gruposByCodigo, ...runtimeGruposByCodigo };
    const gruposNomeMap = { ...gruposByNome, ...runtimeGruposByNome };
    let grupoIdResolved =
      (rawGrupoId && gruposCodigoMap[rawGrupoId]) ||
      (rawGrupoNome && gruposNomeMap[norm(rawGrupoNome)]) ||
      undefined;
    // Fallback fuzzy: tenta casar por parte do nome/código quando não houver correspondência exata
    if (!grupoIdResolved) {
      const tgt = norm(rawGrupoNome || rawGrupoId || '');
      if (tgt) {
        const candidates = (gruposProduto || []).filter(g => {
          const gn = norm(g.nome_grupo || g.nome || '');
          const gc = String(g.codigo || '').trim();
          return (gn && (gn.includes(tgt) || tgt.includes(gn))) || (rawGrupoId && gc === String(rawGrupoId).trim());
        });
        if (candidates.length === 1) {
          grupoIdResolved = candidates[0].id;
        }
      }
    }
    // Corrigir associações erradas: só usar ID mapeado de fato; nunca forçar ID vindo da planilha se não existir
    const grupoNomeResolved =
      rawGrupoNome ||
      (gruposProduto.find((g) => g.id === grupoIdResolved)?.nome_grupo ||
       gruposProduto.find((g) => String(g.codigo || '') === String(rawGrupoId || ''))?.nome_grupo) ||
      undefined;

    const rawSetorId = sanitize(getWithMap(row, 'setor_atividade_id'));
    const rawSetorNome = sanitize(getWithMap(row, 'setor_atividade_nome'));
    const setoresNomeMap = { ...setoresByNome, ...runtimeSetoresByNome };
    let setorIdResolved =
      (rawSetorNome && setoresNomeMap[norm(rawSetorNome)]) ||
      (rawSetorId && setoresNomeMap[norm(rawSetorId)]) ||
      undefined;
    if (!setorIdResolved) {
      const tgtS = norm(rawSetorNome || rawSetorId || '');
      if (tgtS) {
        const hitS = (setoresAtividade || []).find(s => {
          const sn = norm(s.nome || s.descricao || s.nome_setor || '');
          const sc = String(s.codigo || '').trim();
          return sn.includes(tgtS) || tgtS.includes(sn) || (rawSetorId && sc === String(rawSetorId).trim());
        });
        if (hitS) setorIdResolved = hitS.id;
      }
    }
    const setorNomeResolved =
      rawSetorNome ||
      (setoresAtividade.find((s) => s.id === setorIdResolved)?.nome || undefined);

    const produto = {
      empresa_id: empresaId,
      codigo: sanitize(getWithMap(row, 'codigo')),
      descricao: sanitize(getWithMap(row, 'descricao'))?.slice(0, 250),
      unidade_medida: mapUnidade(getWithMap(row, 'unidade_medida')),
      estoque_minimo: num(getWithMap(row, 'estoque_minimo')) || 0,
      // estoques sempre iniciam zerados ao importar planilha
      estoque_atual: 0,
      estoque_reservado: 0,
      estoque_disponivel: 0,
      ncm: sanitizeNCM(getWithMap(row, 'ncm')),
      peso_teorico_kg_m: num(getWithMap(row, 'peso_teorico_kg_m')),
      grupo_produto_id: grupoIdResolved,
      grupo_produto_nome: grupoNomeResolved,
      peso_liquido_kg: num(getWithMap(row, 'peso_liquido_kg')),
      peso_bruto_kg: num(getWithMap(row, 'peso_bruto_kg')),
      setor_atividade_id: setorIdResolved,
      setor_atividade_nome: setorNomeResolved,
      custo_aquisicao: num(getWithMap(row, 'custo_aquisicao')),
      tipo_item: mapTipoItem(getWithMap(row, 'tipo_item')),
      status: "Ativo",
      modo_cadastro: "Lote/Importação",
    };

    // Remover indefinidos
    Object.keys(produto).forEach((k) => produto[k] === undefined && delete produto[k]);
    return produto;
  };


  const handleArquivo = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setArquivo(f);
    setProcessando(true);
    try {
      if (!empresaId && !grupoId) {
        setErro('Selecione a empresa OU um grupo antes de importar.');
        toast.error('Selecione a empresa ou um grupo.');
        return;
      }
      if (!canImportarProdutos) {
        const motivo = 'Sem permissao para processar planilha de produtos.';
        await auditImportadorProdutos({ acao: 'estoque.produtos.importacao_planilha.processamento_bloqueado', sucesso: false, motivo, dados: { arquivo: f.name } });
        setErro(motivo);
        toast.error(motivo);
        return;
      }
      const rows = await extrairLinhas(f);
      if (!rows.length) {
        toast.error("Não encontramos linhas na planilha.");
        return;
      }

      setParsedRows(rows);
      const dataRows = rows.filter((r) => !isHeaderRow(r));
      setTotalLinhas(dataRows.length);

      // Criar automaticamente unidades de medida ausentes (opção B)
      try {
        const unidadesDetectadas = new Set();
        for (const r of dataRows) {
          const rawUnit = sanitize(getWithMap(r, 'unidade_medida'));
          if (!rawUnit) continue;
          const mapped = mapUnidade(rawUnit);
          if (!mapped || !UNIDADES_ACEITAS.includes(mapped)) {
            const sigla = String(rawUnit).trim().toUpperCase().replace(/\s+/g, '');
            if (sigla) unidadesDetectadas.add(sigla);
          }
        }
        if (unidadesDetectadas.size) {
          let existentes = [];
          try {
            existentes = await filterInContext('UnidadeMedida', {}, 'sigla', 500);
          } catch (_) {}
          const existentesSet = new Set((existentes || []).map(u => String(u.sigla || '').toUpperCase().trim()));
          const novosUM = Array.from(unidadesDetectadas).filter(s => !existentesSet.has(s));
          if (novosUM.length) {
            const payloadsUM = novosUM.map(sigla => ({
              sigla,
              nome_completo: sigla,
              tipo_grandeza: 'Outro',
              permite_conversao: true,
              fator_conversao_para_base: 1,
              usa_em_estoque: true,
              usa_em_compras: true,
              usa_em_vendas: true,
              usa_em_producao: false,
              ativo: true,
              ...(grupoId ? { group_id: grupoId } : {})
            }));
            for (let i = 0; i < payloadsUM.length; i += 20) {
              const slice = payloadsUM.slice(i, i + 20);
              await Promise.allSettled(slice.map(p => createInContext('UnidadeMedida', p)));
              await sleep(200);
            }
          }
        }
      } catch (_) { /* não bloquear import preview por UM */ }

      // Captura e salva os cabeçalhos disponíveis para auto-mapeamento
      const headersDetectados = Array.from(
        new Set(dataRows.flatMap((r) => Object.keys(r || {})))
      ).filter(Boolean);
      setAvailableHeaders(headersDetectados);
      setColumnMap(autoMapFromHeaders(headersDetectados));

      // Montar preview com TODOS os itens
      const baseAll = dataRows
          .map((r) => montarProduto(r))
          .map((p) => ({
            ...p,
            // Garantir mapeamento correto: estoques iniciam zerados; estoque_minimo vem da planilha
            estoque_atual: 0,
            estoque_reservado: 0,
            estoque_disponivel: 0,
            unidade_medida: UNIDADES_ACEITAS.includes(p.unidade_medida) ? p.unidade_medida : 'UN'
          }))
          .filter((p) => p?.descricao);
        setPreview(baseAll);
        setBaseProdutos(baseAll);
      setErro('');
      toast.success(`Arquivo lido: ${dataRows.length} item(ns) de produto`);
    } finally {
      setProcessando(false);
    }
  };

  const importar = async () => {
    setErro('');
    if (!arquivo) {
      setErro('Selecione um arquivo válido.');
      toast.error("Selecione um arquivo válido.");
      return;
    }
    if (!empresaId && !grupoId) {
      setErro('Selecione a empresa de destino ou um grupo.');
      toast.error('Selecione a empresa ou um grupo.');
      return;
    }
    if (!canImportarProdutos) {
      const motivo = 'Sem permissao para importar produtos.';
      await auditImportadorProdutos({ acao: 'estoque.produtos.importacao_planilha.bloqueada', sucesso: false, motivo });
      setErro(motivo);
      toast.error(motivo);
      return;
    }
    const produtosAlvoConfirmacao = getProdutosAlvo();
    const qtdAtualizar = duplicidades.filter((d) => escolhasDuplicidades[makeKey(d.empresa_id, d.codigo)] === 'atualizar').length;
    const qtdSubstituir = duplicidades.filter((d) => escolhasDuplicidades[makeKey(d.empresa_id, d.codigo)] === 'substituir').length;
    const qtdPular = duplicidades.filter((d) => !['atualizar', 'substituir'].includes(escolhasDuplicidades[makeKey(d.empresa_id, d.codigo)])).length;
    const confirmado = window.confirm([
      'Confirma a importacao de produtos nesta base do ERP?',
      'Arquivo: ' + (arquivo?.name || '-'),
      'Destino: ' + (grupoId ? 'Grupo' : 'Empresa') + ' ' + (grupoId || empresaId),
      'Produtos alvo: ' + produtosAlvoConfirmacao.length,
      'Duplicados para atualizar: ' + qtdAtualizar,
      'Duplicados para substituir/excluir e recriar: ' + qtdSubstituir,
      'Duplicados para pular: ' + qtdPular,
      'Esta acao sera auditada com grupo e empresa.'
    ].join('\n'));
    if (!confirmado) {
      await auditImportadorProdutos({
        acao: 'estoque.produtos.importacao_planilha.cancelada',
        sucesso: false,
        motivo: 'Usuario cancelou a importacao de produtos.',
        dados: { produtos_alvo: produtosAlvoConfirmacao.length, qtd_atualizar: qtdAtualizar, qtd_substituir: qtdSubstituir, qtd_pular: qtdPular }
      });
      return;
    }
    // Valida se os campos essenciais estão mapeados
    const mapa = columnMap || {};
    if (!mapa.descricao || !mapa.unidade_medida) {
      toast.warning('Revise o mapeamento: "Descrição" e "Unidade" devem estar definidos.');
    }
    toast("Iniciando importação...");
    setProcessando(true);
    try {
      // Reextrai linhas para processar tudo (não só o preview)
      const rows = await extrairLinhas(arquivo);
      const dataRows = rows.filter((r) => !isHeaderRow(r));

      // 1) Criar automaticamente grupos e setores ausentes
      const localGruposByCodigo = { ...gruposByCodigo };
      const localGruposByNome = { ...gruposByNome };
      const localSetoresByNome = { ...setoresByNome };

      const gruposPendentes = new Map();
      const setoresPendentes = new Map();

      for (const r of dataRows) {
        const rawGrupoId = sanitize(getWithMap(r, 'grupo_produto_id'));
        const rawGrupoNome = sanitize(getWithMap(r, 'grupo_produto_nome'));
        const rawSetorId = sanitize(getWithMap(r, 'setor_atividade_id'));
        const rawSetorNome = sanitize(getWithMap(r, 'setor_atividade_nome'));

        const grpOk = (rawGrupoId && localGruposByCodigo[rawGrupoId]) || (rawGrupoNome && localGruposByNome[norm(rawGrupoNome)]);
        if (!grpOk && (rawGrupoNome || rawGrupoId)) {
          const chave = norm(rawGrupoNome || rawGrupoId);
          if (!gruposPendentes.has(chave)) gruposPendentes.set(chave, { nome: rawGrupoNome || rawGrupoId, codigo: rawGrupoId || undefined });
        }

        const setOk = (rawSetorNome && localSetoresByNome[norm(rawSetorNome)]);
        if (!setOk && (rawSetorNome || rawSetorId)) {
          const chaveS = norm(rawSetorNome || rawSetorId);
          if (!setoresPendentes.has(chaveS)) setoresPendentes.set(chaveS, { nome: rawSetorNome || rawSetorId });
        }
      }

      if (gruposPendentes.size) {
        const payloads = Array.from(gruposPendentes.values()).map(g => ({
          nome_grupo: g.nome,
          codigo: g.codigo || undefined,
          natureza: 'Revenda',
          ativo: true,
          ...(grupoId ? { group_id: grupoId } : {})
        }));
        for (let i = 0; i < payloads.length; i += 10) {
          const slice = payloads.slice(i, i + 10);
          const res = await Promise.allSettled(slice.map(p => createInContext('GrupoProduto', p)));
          res.forEach((r, idx) => {
            if (r.status === 'fulfilled') {
              const p = slice[idx];
              const key = norm(p.nome_grupo);
              localGruposByNome[key] = r.value.id;
              if (p.codigo) localGruposByCodigo[String(p.codigo).trim()] = r.value.id;
            }
          });
          await sleep(300);
        }
      }

      if (setoresPendentes.size) {
        const payloadsS = Array.from(setoresPendentes.values()).map(s => ({
          nome: s.nome,
          tipo_operacao: 'Revenda',
          ativo: true,
          ...(grupoId ? { group_id: grupoId } : {})
        }));
        for (let i = 0; i < payloadsS.length; i += 10) {
          const slice = payloadsS.slice(i, i + 10);
          const resS = await Promise.allSettled(slice.map(p => createInContext('SetorAtividade', p)));
          resS.forEach((r, idx) => {
            if (r.status === 'fulfilled') {
              const p = slice[idx];
              const key = norm(p.nome);
              localSetoresByNome[key] = r.value.id;
            }
          });
          await sleep(300);
        }
      }

      // disponibilizar mapas criados para o montador
      runtimeGruposByCodigo = localGruposByCodigo;
      runtimeGruposByNome = localGruposByNome;
      runtimeSetoresByNome = localSetoresByNome;

      // 2) Agora montar os produtos com os mapas atualizados
      const baseProdutos = dataRows.map((r) => montarProduto(r)).filter((p) => p?.descricao);
      let produtos;
      if ((importarParaTodasEmpresas && grupoId && empresas?.length) || (!empresaId && grupoId && empresas?.length)) {
        produtos = empresas.flatMap(emp => baseProdutos.map(p => ({ ...p, empresa_id: emp.id, group_id: grupoId, compartilhado_grupo: true })));
      } else {
        produtos = baseProdutos;
      }
      // Garantir empresa_id e group_id válidos
      produtos = produtos.map(p => ({
        ...p,
        empresa_id: p.empresa_id || empresaId || empresaAtual?.id || (empresas[0]?.id || ''),
        ...(grupoId ? { group_id: grupoId } : {})
      }));

      // B: garantir unidade válida sem travar a importação (fallback para UN)
      produtos = produtos.map(p => ({
        ...p,
        unidade_medida: UNIDADES_ACEITAS.includes(p.unidade_medida) ? p.unidade_medida : 'UN',
        estoque_atual: 0,
        estoque_reservado: 0,
        estoque_disponivel: 0,
      }));

      // Deduplicar internamente por empresa+codigo (mantém a primeira ocorrência)
      const seenKeys = new Set();
      produtos = produtos.filter(p => {
        const k = makeKey(p.empresa_id, p.codigo);
        if (seenKeys.has(k)) return false;
        seenKeys.add(k);
        return true;
      });

      const skipDupFlow = (gruposPendentes.size > 0) || (setoresPendentes.size > 0);
      // Segurança extra: remover já existentes no banco (empresa+codigo)
      if (!skipDupFlow) {
        const keysToCheck = Array.from(new Set(produtos.map(p => makeKey(p.empresa_id, p.codigo))));
        const existingSet = new Set();
        let delayExist = 0;
        for (let i = 0; i < keysToCheck.length; i += 10) {
          const slice = keysToCheck.slice(i, i + 10);
          if (delayExist) await sleep(delayExist);
          const checks = await Promise.allSettled(slice.map(async (k) => {
            const [empId, code] = k.split('__');
            try {
              const found = await filterInContext('Produto', { empresa_id: empId, codigo: code }, undefined, 1);
              if (Array.isArray(found) && found.length > 0) existingSet.add(k);
            } catch (err) {
              if (String(err?.message || '').toLowerCase().includes('rate limit')) {
                await sleep(600);
                const found = await filterInContext('Produto', { empresa_id: empId, codigo: code }, undefined, 1);
                if (Array.isArray(found) && found.length > 0) existingSet.add(k);
              }
            }
            return null;
          }));
          if (checks.some(r => r.status === 'rejected')) {
            delayExist = Math.min((delayExist || 300) * 1.5, 4000);
          }
          await sleep(250);
        }
        produtos = produtos.filter(p => !existingSet.has(makeKey(p.empresa_id, p.codigo)));
      }

      // Não filtramos por erros pré-calculados para garantir a importação completa; falhas serão reportadas individualmente pelo backend.
      // Garantir que group_id e empresa_id sejam mantidos, e IDs resolvidos por nome/código já aplicados em montarProduto.

      let updatedTotal = 0;
      let replacedTotal = 0;
      if (!skipDupFlow) {
        // Processar duplicidades conforme escolha do usuário
        const paraAtualizar = duplicidades.filter(d => {
          const k = makeKey(d.empresa_id, d.codigo);
          return escolhasDuplicidades[k] === 'atualizar';
        });
        const paraSubstituir = duplicidades.filter(d => {
          const k = makeKey(d.empresa_id, d.codigo);
          return escolhasDuplicidades[k] === 'substituir';
        });
        
        // Atualizar (mesclar dados)
        if (paraAtualizar.length > 0) {
          const chunkU = 20;
          for (let i = 0; i < paraAtualizar.length; i += chunkU) {
            const parte = paraAtualizar.slice(i, i + chunkU);
            const res = await Promise.allSettled(parte.map(async (d) => {
              const patch = { ...d.novo };
              delete patch.id;
              delete patch.empresa_id;
              delete patch.group_id;
              delete patch.created_date;
              delete patch.updated_date;
              delete patch.created_by;
              delete patch.codigo;
              if (patch.ncm != null) patch.ncm = sanitizeNCM(patch.ncm);
              Object.keys(patch).forEach(k => patch[k] === undefined && delete patch[k]);
              try {
                return await updateInContext('Produto', d.existente.id, withProdutoContexto(patch, d.novo));
              } catch (err) {
                const msg = String(err?.message || '').toLowerCase();
                const status = err?.response?.status || err?.status;
                if (status === 404 || msg.includes('not found') || msg.includes('does not exist') || msg.includes('no such')) {
                  return await createInContext('Produto', withProdutoContexto({ ...patch, codigo: d.codigo }, d.novo));
                }
                if (msg.includes('rate limit')) {
                  await sleep(600 + Math.floor(Math.random() * 200));
                  try {
                    return await updateInContext('Produto', d.existente.id, withProdutoContexto(patch, d.novo));
                  } catch (err2) {
                    const msg2 = String(err2?.message || '').toLowerCase();
                    if (msg2.includes('rate limit')) {
                      await sleep(1200 + Math.floor(Math.random() * 300));
                      return await updateInContext('Produto', d.existente.id, withProdutoContexto(patch, d.novo));
                    }
                    throw err2;
                  }
                }
                throw err;
              }
            }));
            updatedTotal += res.filter(r => r.status === 'fulfilled').length;
            await sleep(300);
          }
        }
        
        // Substituir (deletar e recriar)
        if (paraSubstituir.length > 0) {
          const chunkS = 20;
          for (let i = 0; i < paraSubstituir.length; i += chunkS) {
            const parte = paraSubstituir.slice(i, i + chunkS);
            const res = await Promise.allSettled(parte.map(async (d) => {
              try {
                await deleteInContext('Produto', d.existente.id);
                await sleep(200);
                return await createInContext('Produto', withProdutoContexto({ ...d.novo, codigo: d.codigo }, d.novo));
              } catch (err) {
                const msg = String(err?.message || '').toLowerCase();
                if (msg.includes('rate limit')) {
                  await sleep(600 + Math.floor(Math.random() * 200));
                  try {
                    await deleteInContext('Produto', d.existente.id);
                    await sleep(200);
                    return await createInContext('Produto', withProdutoContexto({ ...d.novo, codigo: d.codigo }, d.novo));
                  } catch (err2) {
                    throw err2;
                  }
                }
                throw err;
              }
            }));
            replacedTotal += res.filter(r => r.status === 'fulfilled').length;
            await sleep(300);
          }
        }

        // Remover todas as duplicidades da criação (pular, atualizar ou substituir)
        const dupKeys = new Set(duplicidades.map(d => makeKey(d.empresa_id, d.codigo)));
        produtos = produtos.filter(p => !dupKeys.has(makeKey(p.empresa_id, p.codigo)));
      }

      if (produtos.length === 0) {
        // Se criamos grupos/setores agora, não interromper prematuramente: tentar criar mesmo assim
        if (skipDupFlow) {
          // prosseguir para etapa de criação (pode ter sido filtrado tudo por verificações anteriores)
        } else {
          const hasDesc = parsedRows.some(r => !!(getWithMap(r, 'descricao') || sanitize(get(r, HEADERS.descricao))));
          const hasUn = parsedRows.some(r => !!(getWithMap(r, 'unidade_medida') || sanitize(get(r, HEADERS.unidade_medida))));
          const expectedDesc = HEADERS.descricao.filter(h => h.length > 1).join(', ');
          const expectedUn = HEADERS.unidade_medida.filter(h => h.length > 1).join(', ');
          const headersPrimeiros = (() => {
              const set = new Set();
              (Array.isArray(parsedRows) ? parsedRows.slice(0,5) : []).forEach(r => Object.keys(r || {}).forEach(k => set.add(String(k))));
              return Array.from(set);
            })();
          const dicas = [];
          if (!hasDesc) dicas.push(`- Cabeçalho de Descrição ausente (ex.: ${expectedDesc}).`);
          if (!hasUn) dicas.push(`- Cabeçalho de Unidade ausente (ex.: ${expectedUn}).`);
          if (!empresaId && !grupoId) dicas.push('- Selecione a empresa de destino ou um grupo.');
          const msg = `Nada para importar. Verifique o cabeçalho da planilha e os campos obrigatórios.\nObrigatórios: Descrição, Unidade (Un.) e Empresa ou Grupo de destino.\n${dicas.join('\n')}\nDetectamos estes cabeçalhos: ${headersPrimeiros.join(', ')}\nMapeamento atual: ${JSON.stringify(columnMap)}`;
          setErro(msg);
          toast.error('Nada para importar. Veja os detalhes acima.');
          return;
        }
      }

      // Se criamos grupos/setores agora, preparar mapa de existentes para atualizar em vez de criar
      const existingByKey = {};
      if (skipDupFlow) {
        const keys = Array.from(new Set(produtos.map(p => makeKey(p.empresa_id, p.codigo))));
        for (let i = 0; i < keys.length; i += 10) {
          const slice = keys.slice(i, i + 10);
          await Promise.allSettled(slice.map(async (k) => {
            const [empId, code] = k.split('__');
            try {
              const found = await filterInContext('Produto', { empresa_id: empId, codigo: code }, undefined, 1);
              if (Array.isArray(found) && found[0]) existingByKey[k] = found[0];
            } catch (err) {
              if (String(err?.message || '').toLowerCase().includes('rate limit')) {
                await sleep(600);
                const found = await filterInContext('Produto', { empresa_id: empId, codigo: code }, undefined, 1);
                if (Array.isArray(found) && found[0]) existingByKey[k] = found[0];
              }
            }
            return null;
          }));
          await sleep(250);
        }
      }

      // Importação com controle de taxa: pequenos lotes + backoff simples para evitar rate limit
      const chunkSize = 10; // reduzir ainda mais o lote para estabilidade
      let createdTotal = 0;
      let failedTotal = 0;
      let delay = 0;
      for (let i = 0; i < produtos.length; i += chunkSize) {
        const chunk = produtos.slice(i, i + chunkSize);
        if (delay) await sleep(delay);
        const results = await Promise.allSettled(chunk.map(async (p) => {
          const key = makeKey(p.empresa_id, p.codigo);
          const existente = skipDupFlow ? existingByKey[key] : null;
          if (existente) {
            // Atualizar existente com dados novos
            const patch = { ...p };
            delete patch.id;
            delete patch.empresa_id;
            delete patch.group_id;
            delete patch.created_date;
            delete patch.updated_date;
            delete patch.created_by;
            delete patch.codigo;
            if (patch.ncm != null) patch.ncm = sanitizeNCM(patch.ncm);
            Object.keys(patch).forEach(k => patch[k] === undefined && delete patch[k]);
            try {
              return await updateInContext('Produto', existente.id, withProdutoContexto(patch, p));
            } catch (err) {
              const msg = String(err?.message || '').toLowerCase();
              if (msg.includes('rate limit')) {
                await sleep(800 + Math.floor(Math.random() * 200));
                try {
                  return await updateInContext('Produto', existente.id, withProdutoContexto(patch, p));
                } catch (err2) {
                  const msg2 = String(err2?.message || '').toLowerCase();
                  if (msg2.includes('rate limit')) {
                    await sleep(1500 + Math.floor(Math.random() * 300));
                    return await updateInContext('Produto', existente.id, withProdutoContexto(patch, p));
                  }
                  throw err2;
                }
              }
              // se por algum motivo não encontrar mais, cria
              if (msg.includes('not found')) {
                return await createInContext('Produto', withProdutoContexto({ ...p }, p));
              }
              throw err;
            }
          } else {
            try {
              return await createInContext('Produto', withProdutoContexto(p, p));
            } catch (err) {
              const msg = String(err?.message || '').toLowerCase();
              if (msg.includes('rate limit')) {
                // backoff com jitter e até 2 tentativas
                await sleep(800 + Math.floor(Math.random() * 200));
                try {
                  return await createInContext('Produto', withProdutoContexto(p, p));
                } catch (err2) {
                  const msg2 = String(err2?.message || '').toLowerCase();
                  if (msg2.includes('rate limit')) {
                    await sleep(1500 + Math.floor(Math.random() * 300));
                    return await createInContext('Produto', withProdutoContexto(p, p));
                  }
                  throw err2;
                }
              }
              throw err;
            }
          }
        }));
        const failures = results.filter(r => r.status === 'rejected');
        // se muitos 429 no lote, aumentar pequeno delay para próximo
        if (failures.length > 0 && failures.some(f => String(f.reason?.message || '').toLowerCase().includes('rate limit'))) {
          delay = Math.min((delay || 400) * 1.5, 5000);
        }
        failedTotal += failures.length;
        createdTotal += results.filter(r => r.status === 'fulfilled').length;
        // Pequena pausa entre lotes para evitar limites de taxa
        await sleep(300 + Math.floor(Math.random() * 150));
      }

      const processados = createdTotal + (updatedTotal || 0) + (replacedTotal || 0);
      const msgs = [];
      if (createdTotal > 0) msgs.push(`${createdTotal} criados`);
      if (updatedTotal > 0) msgs.push(`${updatedTotal} atualizados`);
      if (replacedTotal > 0) msgs.push(`${replacedTotal} substituídos`);
      if (failedTotal > 0) msgs.push(`${failedTotal} falharam`);
      
      await auditImportadorProdutos({
        acao: 'estoque.produtos.importacao_planilha.concluida',
        sucesso: failedTotal === 0,
        motivo: failedTotal > 0 ? 'Importacao de produtos concluida com falhas.' : 'Importacao de produtos concluida com sucesso.',
        dados: {
          produtos_alvo: produtos.length,
          criados: createdTotal,
          atualizados: updatedTotal || 0,
          substituidos: replacedTotal || 0,
          falhas: failedTotal,
          duplicidades: duplicidades.length,
          grupo_destino_id: grupoId || null,
          empresa_destino_id: empresaId || null,
        },
      });
      if (failedTotal > 0) {
        toast.warning(`Importação concluída: ${processados} processados (${msgs.join(', ')}).`);
      } else {
        toast.success(`Importação concluída: ${processados} processados (${msgs.join(', ')}).`);
      }
      onConcluido && onConcluido();
      closeSelf && closeSelf();
    } catch (e) {
      await auditImportadorProdutos({
        acao: 'estoque.produtos.importacao_planilha.erro',
        sucesso: false,
        motivo: e?.message || 'Erro ao importar produtos por planilha.',
        dados: { arquivo: arquivo?.name || null }
      });
      toast.error(e?.message || "Erro ao importar");
    } finally {
      setProcessando(false);
    }
  };

  return (
    <Card className="border-indigo-200 w-full h-full" data-permission="Estoque.Produtos.importar" data-context-required="group-or-company" data-context-mode={contexto}>
      <CardHeader className="bg-slate-50 border-b">
        <CardTitle className="text-base">Importar Planilha de Produtos</CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        <Alert className="border-indigo-200 bg-indigo-50">
          <AlertDescription className="text-sm text-indigo-900">
            Envie uma planilha com 14 colunas (A–N) e cabeçalho na linha 1. Dados a partir da linha 2. Formatos: XLS, XLSX, CSV, CSV UTF‑8.
          </AlertDescription>
        </Alert>

        {(!hasDestinoImportacao || !canImportarProdutos) && (
          <Alert variant="destructive">
            <AlertDescription className="text-sm">
              {!hasDestinoImportacao
                ? 'Selecione grupo ou empresa antes de processar a planilha.'
                : 'Seu perfil nao possui permissao para importar produtos.'}
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>Grupo (opcional)</Label>
            <Select value={grupoId} onValueChange={(v) => { setGrupoId(v); setEmpresaId(''); }}>
              <SelectTrigger data-permission="Estoque.Produtos.importar" data-action="Estoque.Produtos.importar.selecionar-grupo">
                <SelectValue placeholder="Selecione o grupo (opcional)" />
              </SelectTrigger>
              <SelectContent>
                {(groupsOptions || []).map((g) => (
                                        <SelectItem key={g.id} value={g.id}>
                                          {g.nome_fantasia || g.razao_social || g.nome_do_grupo || g.nome || g.descricao || g.sigla || g.id}
                                        </SelectItem>
                                      ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Empresa de destino</Label>
            <Select value={empresaId} onValueChange={setEmpresaId} disabled={!!grupoId}>
              <SelectTrigger data-permission="Estoque.Produtos.importar" data-action="Estoque.Produtos.importar.selecionar-empresa">
                <SelectValue placeholder="Selecione a empresa" />
              </SelectTrigger>
              <SelectContent>
                {empresas.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.nome_fantasia || e.razao_social || e.nome || e.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Input
            type="file"
            accept=".xls,.xlsx,.csv,text/csv"
            onChange={handleArquivo}
            disabled={processando || !hasDestinoImportacao || !canImportarProdutos}
            data-permission="Estoque.Produtos.importar"
            data-action="Estoque.Produtos.importar.selecionar-arquivo"
            data-context-required="group-or-company"
          />
          {arquivo && (
            <p className="text-xs text-slate-500 mt-1">{arquivo.name}</p>
          )}
        </div>

        {erro && (
          <Alert variant="destructive">
            <AlertDescription className="text-sm">{erro}</AlertDescription>
          </Alert>
        )}

        {preview.length > 0 && (
          <Card className="border-slate-200">
            <CardHeader className="bg-slate-50 border-b">
            <CardTitle className="text-sm">Pré-visualização ({preview.length} de {totalLinhas} itens){importarParaTodasEmpresas || (!empresaId && grupoId) ? ' • Modo: Grupo (todas as empresas)' : ''} • Grupos: {Array.from(new Set(preview.map(p => p.grupo_produto_nome || p.grupo_produto_id).filter(Boolean))).length} • Setores: {Array.from(new Set(preview.map(p => p.setor_atividade_nome || p.setor_atividade_id).filter(Boolean))).length} • NCMs pendentes: {invalidNCMKeys.size}</CardTitle>
            </CardHeader>
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs text-slate-600">NCMs pendentes: {invalidNCMKeys.size}</div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={sugerirNCMsIA} disabled={suggesting || invalidNCMKeys.size === 0} className="gap-1" data-permission="Estoque.Produtos.importar" data-action="Estoque.Produtos.importar.sugerir-ncm-ia">
                    {suggesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />} Sugerir NCMs (IA)
                  </Button>
                  {Object.keys(ncmSuggestions || {}).length > 0 && (
                    <Button variant="secondary" size="sm" onClick={applyAllSuggestions} data-permission="Estoque.Produtos.importar" data-action="Estoque.Produtos.importar.aplicar-ncm-ia">Aplicar todos</Button>
                  )}
                </div>
              </div>
              <div className="max-h-64 overflow-auto border rounded">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-white">
                      <TableHead>Código</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>UN</TableHead>
                      <TableHead>Estoque Mín.</TableHead>
                      <TableHead>NCM</TableHead>
                      <TableHead>Sugestão IA</TableHead>
                      <TableHead>Custo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.map((p, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{p.codigo || "-"}</TableCell>
                        <TableCell className="font-medium">{p.descricao}</TableCell>
                        <TableCell>{p.unidade_medida}</TableCell>
                        <TableCell>{p.estoque_minimo ?? 0}</TableCell>
                        <TableCell className={invalidNCMKeys.has(makeKey(p.empresa_id, p.codigo)) ? "bg-amber-50 text-amber-800" : ""}>
                          <div className="flex items-center gap-1">
                            <span>{p.ncm || "-"}</span>
                            {invalidNCMKeys.has(makeKey(p.empresa_id, p.codigo)) && (
                              <AlertCircle className="w-4 h-4 text-amber-600" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {invalidNCMKeys.has(makeKey(p.empresa_id, p.codigo)) ? (
                            ncmSuggestions[makeKey(p.empresa_id, p.codigo)] ? (
                              <div className="flex items-center gap-2">
                                <Badge variant="outline">{ncmSuggestions[makeKey(p.empresa_id, p.codigo)]}</Badge>
                                <Button size="sm" variant="outline" onClick={() => applySuggestion(makeKey(p.empresa_id, p.codigo))}>Aplicar</Button>
                              </div>
                            ) : (
                              <span className="text-amber-600 text-xs">Aguardando sugestão</span>
                            )
                          ) : (
                            <span className="text-green-600 text-xs">OK</span>
                          )}
                        </TableCell>
                        <TableCell>R$ {(p.custo_aquisicao || 0).toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex items-center gap-3">
                <Checkbox id="importar-grupo" checked={importarParaTodasEmpresas} onCheckedChange={(v) => setImportarParaTodasEmpresas(!!v)} data-permission="Estoque.Produtos.importar" data-action="Estoque.Produtos.importar.todas-empresas" />
                <Label htmlFor="importar-grupo" className="text-sm">
                  Importar para todas as empresas do grupo selecionado
                </Label>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Resumo de auto-mapeamento e correção manual */}
        {availableHeaders.length > 0 && (
          <Card className="border-slate-200 mt-4">
            <CardHeader className="bg-slate-50 border-b">
              <CardTitle className="text-sm">Mapeamento automático de colunas</CardTitle>
            </CardHeader>
            <CardContent className="p-3 space-y-3">
              <div className="text-xs text-slate-600">Revise abaixo as correspondências sugeridas. Você pode ajustar manualmente.</div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {Object.keys(FIELD_LABELS).map((field) => (
                  <div key={field} className="flex items-center gap-2">
                    <Label className="w-40 text-xs text-slate-700">{FIELD_LABELS[field]}</Label>
                    <Select
                      value={columnMap[field] || ''}
                      onValueChange={(v) => setColumnMap((prev) => ({ ...prev, [field]: v }))}
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue placeholder="Detectar automaticamente" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={null}>(Auto)</SelectItem>
                        {availableHeaders.map((h) => (
                          <SelectItem key={`${field}-${h}`} value={h}>{h}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Duplicidades */}
        {duplicidades.length > 0 && (
          <Card className="border-amber-200 mt-4">
            <CardHeader className="bg-amber-50 border-b">
              <CardTitle className="text-sm">Produtos duplicados por código na empresa ({duplicidades.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-3 space-y-3">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Label className="text-sm font-semibold">Estratégia Global:</Label>
                  <Select value={estrategiaDuplicidadeGlobal} onValueChange={(v) => {
                    setEstrategiaDuplicidadeGlobal(v);
                    const all = {};
                    duplicidades.forEach(d => { all[makeKey(d.empresa_id, d.codigo)] = v; });
                    setEscolhasDuplicidades(all);
                  }}>
                    <SelectTrigger className="w-64">
                      <SelectValue placeholder="Escolha o que fazer" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pular">Pular (manter existente)</SelectItem>
                      <SelectItem value="atualizar">Atualizar (mesclar dados)</SelectItem>
                      <SelectItem value="substituir">Substituir (sobrescrever tudo)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Alert className="bg-blue-50 border-blue-200">
                  <AlertDescription className="text-xs text-blue-800">
                    <strong>Pular:</strong> Mantém o produto existente sem alterações.<br />
                    <strong>Atualizar:</strong> Atualiza apenas os campos novos na planilha, preservando dados existentes.<br />
                    <strong>Substituir:</strong> Sobrescreve completamente o produto com os dados da planilha.
                  </AlertDescription>
                </Alert>
              </div>
              <div className="max-h-56 overflow-auto border rounded">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-white">
                      <TableHead>Empresa</TableHead>
                      <TableHead>Código</TableHead>
                      <TableHead>Descrição (existente → novo)</TableHead>
                      <TableHead>Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {duplicidades.map((d, idx) => {
                      const key = makeKey(d.empresa_id, d.codigo);
                      const escolha = escolhasDuplicidades[key] || '';
                      return (
                        <TableRow key={idx}>
                          <TableCell>{d.empresa_id}</TableCell>
                          <TableCell>{d.codigo}</TableCell>
                          <TableCell>
                            <div className="text-xs">
                              <div><span className="text-slate-500">Existente:</span> {d.existente?.descricao || '-'}</div>
                              <div><span className="text-slate-500">Novo:</span> {d.novo?.descricao || '-'}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Select value={escolha} onValueChange={(v) => setEscolhasDuplicidades(prev => ({ ...prev, [key]: v }))}>
                              <SelectTrigger className="w-40">
                                <SelectValue placeholder="Escolha" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="pular">Pular (manter existente)</SelectItem>
                                <SelectItem value="atualizar">Atualizar (mesclar dados)</SelectItem>
                                <SelectItem value="substituir">Substituir (sobrescrever tudo)</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Relatório de erros */}
        {(checando || validationErrors.length > 0) && (
          <Card className="border-red-200 mt-4">
            <CardHeader className="bg-red-50 border-b">
              <CardTitle className="text-sm flex items-center justify-between w-full">
                <span>
                  {checando ? 'Validando produtos…' : `Erros de validação (${validationErrors.length})`}
                </span>
                {!checando && validationErrors.length > 0 && (
                  <Button variant="outline" size="sm" onClick={downloadErrosCSV} className="gap-2">
                    <Download className="w-4 h-4" /> Baixar CSV
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            {!checando && validationErrors.length > 0 && (
              <CardContent className="p-3">
                <div className="max-h-56 overflow-auto border rounded">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-white">
                        <TableHead>Empresa</TableHead>
                        <TableHead>Código</TableHead>
                        <TableHead>Motivo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {validationErrors.map((e, i) => (
                        <TableRow key={i}>
                          <TableCell>{e.empresa_id}</TableCell>
                          <TableCell>{e.codigo}</TableCell>
                          <TableCell>{e.motivo}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            )}
          </Card>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => closeSelf && closeSelf()} disabled={processando} data-action="Estoque.Produtos.importar.cancelar">
            Cancelar
          </Button>
          <Button type="button" onClick={importar} disabled={processando || !arquivo || (!empresaId && !grupoId) || checando || !canImportarProdutos} className="gap-2 bg-indigo-600 hover:bg-indigo-700" data-permission="Estoque.Produtos.importar" data-action="Estoque.Produtos.importar.executar" data-context-required="group-or-company">
            {processando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {processando ? "Importando..." : "Importar Agora"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
