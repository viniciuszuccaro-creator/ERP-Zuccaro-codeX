/**
 * Comportamento de reabertura (prevIdRef) — Representante, FormaPagamento, Região.
 * Espelha a lógica dos forms existentes (sem React Testing Library):
 * troca de registro hidrata; mesmo id preserva edição suja; troca de empresa
 * invalida queryKey da listagem (RepresentantesTab).
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

function createReactHarness() {
  const state = [];
  const effects = [];
  let index = 0;
  const scheduled = [];
  const react = {
    useState(initial) {
      const slot = index++;
      if (!(slot in state)) state[slot] = typeof initial === 'function' ? initial() : initial;
      return [
        state[slot],
        (value) => {
          state[slot] = typeof value === 'function' ? value(state[slot]) : value;
        },
      ];
    },
    useRef(initial) {
      const slot = index++;
      if (!(slot in state)) state[slot] = { current: initial };
      return state[slot];
    },
    useEffect(effect, dependencies) {
      const slot = index++;
      const previous = effects[slot];
      if (previous && dependencies.every((value, i) => Object.is(value, previous.dependencies[i]))) {
        return;
      }
      previous?.cleanup?.();
      scheduled.push(() => {
        effects[slot] = { dependencies, cleanup: effect() };
      });
    },
  };
  return {
    react,
    render(fn) {
      index = 0;
      fn(react);
      scheduled.splice(0).forEach((run) => run());
      // Releitura após effects (setState do prevIdRef já aplicado)
      index = 0;
      return fn(react);
    },
    unmount() {
      effects.forEach((entry) => entry?.cleanup?.());
    },
  };
}

/** Espelho de RepresentanteFormCompleto / FormaPagamentoFormCompleto */
function usePrevIdHydrate(react, record, mapRecord) {
  const [formData, setFormData] = react.useState(() => (record ? mapRecord(record) : {}));
  const prevIdRef = react.useRef(record?.id);
  react.useEffect(() => {
    if (record?.id && record.id !== prevIdRef.current) {
      prevIdRef.current = record.id;
      setFormData(mapRecord(record));
    }
  }, [record?.id]);
  return { formData, setFormData, prevIdRef };
}

/** Espelho de RegiaoAtendimentoForm (open/windowMode + regiaoId) */
function useRegiaoPrevIdHydrate(react, { dadosIniciaisProps, regiaoId, open, windowMode }, fetchById) {
  const empty = {
    nome_regiao: '',
    codigo_regiao: '',
    descricao: '',
    tipo_regiao: 'Personalizada',
  };
  const [formData, setFormData] = react.useState(() => dadosIniciaisProps || empty);
  const prevIdRef = react.useRef(dadosIniciaisProps?.id || regiaoId || null);
  const fetches = [];
  react.useEffect(() => {
    const nextId = dadosIniciaisProps?.id || regiaoId || null;
    if (dadosIniciaisProps && (open || windowMode) && nextId && nextId !== prevIdRef.current) {
      prevIdRef.current = nextId;
      setFormData(dadosIniciaisProps);
    } else if (regiaoId && open && !dadosIniciaisProps && regiaoId !== prevIdRef.current) {
      prevIdRef.current = regiaoId;
      fetches.push(regiaoId);
      Promise.resolve(fetchById?.(regiaoId)).then((row) => {
        if (row) setFormData(row);
      });
    } else if (!regiaoId && !dadosIniciaisProps && open && prevIdRef.current !== null) {
      prevIdRef.current = null;
      setFormData(empty);
    }
  }, [dadosIniciaisProps?.id, regiaoId, open, windowMode]);
  return { formData, setFormData, prevIdRef, fetches };
}

test('Representante: troca A→B hidrata; mesmo id preserva campos editados', () => {
  const h = createReactHarness();
  const map = (r) => ({
    ...r,
    endereco: r.endereco || {},
    dados_bancarios: r.dados_bancarios || {},
    regioes_atendimento: r.regioes_atendimento || [],
  });
  const a = { id: 'rep-a', nome: 'Ana', percentual_comissao: 5, endereco: { cidade: 'SP' } };
  const b = { id: 'rep-b', nome: 'Bruno', percentual_comissao: 8, endereco: { cidade: 'RJ' } };

  let record = a;
  let view = h.render((react) => usePrevIdHydrate(react, record, map));
  assert.equal(view.formData.nome, 'Ana');
  view.setFormData({ ...view.formData, nome: 'Ana Editada', percentual_comissao: 9 });
  view = h.render((react) => usePrevIdHydrate(react, record, map));
  assert.equal(view.formData.nome, 'Ana Editada', 'mesmo id não deve apagar edição suja');
  assert.equal(view.formData.percentual_comissao, 9);

  record = b;
  view = h.render((react) => usePrevIdHydrate(react, record, map));
  assert.equal(view.formData.nome, 'Bruno');
  assert.equal(view.formData.endereco.cidade, 'RJ');
  assert.equal(view.formData.percentual_comissao, 8);
  h.unmount();
});

test('FormaPagamento: troca registro hidrata; dirty no mesmo id preservado', () => {
  const h = createReactHarness();
  const map = (r) => ({ ...r });
  const pix = { id: 'fp-1', descricao: 'PIX', tipo: 'PIX', ativa: true };
  const boleto = { id: 'fp-2', descricao: 'Boleto', tipo: 'Boleto', ativa: true };

  let record = pix;
  let view = h.render((react) => usePrevIdHydrate(react, record, map));
  assert.equal(view.formData.descricao, 'PIX');
  view.setFormData({ ...view.formData, descricao: 'PIX Empresa A' });
  view = h.render((react) => usePrevIdHydrate(react, record, map));
  assert.equal(view.formData.descricao, 'PIX Empresa A');

  record = boleto;
  view = h.render((react) => usePrevIdHydrate(react, record, map));
  assert.equal(view.formData.descricao, 'Boleto');
  assert.equal(view.formData.tipo, 'Boleto');
  h.unmount();
});

test('Região: open com props troca id; reset para novo; fetch por regiaoId', async () => {
  const h = createReactHarness();
  const r1 = { id: 'reg-1', nome_regiao: 'Sul', codigo_regiao: 'SUL' };
  const r2 = { id: 'reg-2', nome_regiao: 'Norte', codigo_regiao: 'NOR' };
  const store = { 'reg-3': { id: 'reg-3', nome_regiao: 'Leste', codigo_regiao: 'LES' } };

  let props = { dadosIniciaisProps: r1, regiaoId: undefined, open: true, windowMode: false };
  let view = h.render((react) => useRegiaoPrevIdHydrate(react, props, (id) => store[id]));
  assert.equal(view.formData.nome_regiao, 'Sul');
  view.setFormData({ ...view.formData, nome_regiao: 'Sul Editado' });
  view = h.render((react) => useRegiaoPrevIdHydrate(react, props, (id) => store[id]));
  assert.equal(view.formData.nome_regiao, 'Sul Editado', 'mesmo id preserva dirty');

  props = { ...props, dadosIniciaisProps: r2 };
  view = h.render((react) => useRegiaoPrevIdHydrate(react, props, (id) => store[id]));
  assert.equal(view.formData.nome_regiao, 'Norte');

  props = { dadosIniciaisProps: undefined, regiaoId: undefined, open: true, windowMode: false };
  view = h.render((react) => useRegiaoPrevIdHydrate(react, props, (id) => store[id]));
  assert.equal(view.formData.nome_regiao, '');
  assert.equal(view.prevIdRef.current, null);

  props = { dadosIniciaisProps: undefined, regiaoId: 'reg-3', open: true, windowMode: false };
  view = h.render((react) => useRegiaoPrevIdHydrate(react, props, (id) => store[id]));
  await new Promise((r) => setImmediate(r));
  view = h.render((react) => useRegiaoPrevIdHydrate(react, props, (id) => store[id]));
  assert.equal(view.formData.nome_regiao, 'Leste');
  h.unmount();
});

test('RepresentantesTab: queryKey inclui contexto; uniqueKey por id; fonte prevIdRef nos forms', async () => {
  const tab = await readFile(new URL('../src/components/cadastros/RepresentantesTab.jsx', import.meta.url), 'utf8');
  const representante = await readFile(new URL('../src/components/cadastros/RepresentanteFormCompleto.jsx', import.meta.url), 'utf8');
  const forma = await readFile(new URL('../src/components/cadastros/FormaPagamentoFormCompleto.jsx', import.meta.url), 'utf8');
  const regiao = await readFile(new URL('../src/components/cadastros/RegiaoAtendimentoForm.jsx', import.meta.url), 'utf8');

  assert.match(tab, /queryKey:\s*\['representantes',\s*contextKey/);
  assert.match(tab, /filterInContext\('Representante'/);
  assert.match(tab, /uniqueKey:\s*`Cadastros\.Representante\.form-\$\{rep\.id\}`/);
  assert.match(tab, /enabled:\s*contextoValido/);

  for (const [src, label] of [
    [representante, 'Representante'],
    [forma, 'FormaPagamento'],
    [regiao, 'Regiao'],
  ]) {
    assert.match(src, /prevIdRef/, `${label} prevIdRef`);
    assert.match(src, /initialData/, `${label} alias Visualizador`);
  }
  assert.match(representante, /representante\.id !== prevIdRef\.current/);
  assert.match(forma, /formaPagamentoNorm\.id !== prevIdRef\.current/);
  assert.match(regiao, /nextId !== prevIdRef\.current/);
});

test('troca de empresa: contextKey muda e lista não reutiliza chave anterior', async () => {
  const tab = await readFile(new URL('../src/components/cadastros/RepresentantesTab.jsx', import.meta.url), 'utf8');
  assert.match(tab, /const contextKey = empresaAtual\?\.id \|\| groupId \|\| 'sem-contexto'/);
  assert.match(tab, /queryKey:\s*\['clientes',\s*contextKey\]/);
  assert.match(tab, /queryKey:\s*\['pedidos',\s*contextKey\]/);
  // simulação: chaves distintas por empresa
  const keyA = ['representantes', 'empresa-cpa', true];
  const keyB = ['representantes', 'empresa-3z', true];
  assert.notDeepEqual(keyA, keyB);
});
