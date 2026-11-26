import assert from 'node:assert/strict';

export function restoreDashboardCadastroCounts(text) {
  const restoreCountHunk = (change, previous) => {
    assert.equal(text.split(change).length, 2);
    text = text.replace(change, previous);
  };
  restoreCountHunk('import { buildContextFilter } from "@/components/lib/cadastroCountFilter";\n', '');
  restoreCountHunk('grupoAtual, empresasDoGrupo, filterInContext,', 'grupoAtual, filterInContext,');
  restoreCountHunk(`queryKey: ['produtos-count-dash', ...contextQueryKey, ...(estaNoGrupo
      ? (empresasDoGrupo || []).map(e => e.id).filter(Boolean).sort()
      : [])],`, "queryKey: ['produtos-count-dash', ...contextQueryKey],");
  restoreCountHunk("const filtro = buildContextFilter('Produto', estaNoGrupo ? null : empresaId, groupId, empresasDoGrupo);",
    "const filtro = getFiltroContexto('empresa_id');");
  restoreCountHunk('const { data: totalProdutos, isPending: produtosCountPending } = useQuery({',
    'const { data: totalProdutos = 0 } = useQuery({');
  restoreCountHunk(`const count = resolveDashboardCount({ countValue: response.data?.count });
        return count.fonte === 'count' ? count.total : null;
      } catch (error) {
        reportDashboardFailure('Falha ao contar produtos', error, { scopeType, groupId, empresaId });
        throw error;`, `return resolveDashboardCount({ countValue: response.data?.count, list: produtos }).total;
      } catch (error) {
        reportDashboardFailure('Falha ao contar produtos; usando lista carregada', error, { scopeType, groupId, empresaId });
        return resolveDashboardCount({ list: produtos }).total;`);
  restoreCountHunk(`value: !canSeeEstoque ? 'Sem acesso' : !hasContextoAtivo ? 'Indisponível'
        : produtosCountPending ? 'Carregando' : totalProdutos ?? 'Indisponível',`, 'value: totalProdutos,');
  restoreCountHunk('const { data: totalClientes, isPending: clientesCountPending } = useQuery({',
    'const { data: totalClientes = 0 } = useQuery({');
  restoreCountHunk(`queryKey: ['clientes-count', ...contextQueryKey, ...(estaNoGrupo
      ? (empresasDoGrupo || []).map(e => e.id).filter(Boolean).sort()
      : [])],`, "queryKey: ['clientes-count', ...contextQueryKey],");
  restoreCountHunk("const filtro = buildContextFilter('Cliente', estaNoGrupo ? null : empresaId, groupId, empresasDoGrupo);",
    "const filtro = getFiltroContexto('empresa_id', true);");
  restoreCountHunk(`const count = resolveDashboardCount({ countValue: response.data?.count });
        return count.fonte === 'count' ? count.total : null;
      } catch (error) {
        reportDashboardFailure('Falha ao contar clientes', error, { scopeType, groupId, empresaId });
        throw error;`, `return resolveDashboardCount({ countValue: response.data?.count, list: clientes }).total;
      } catch (error) {
        reportDashboardFailure('Falha ao contar clientes; usando lista carregada', error, { scopeType, groupId, empresaId });
        return resolveDashboardCount({ list: clientes }).total;`);
  restoreCountHunk('    taxaConversao,', '    clientesAtivos,\n    taxaConversao,');
  restoreCountHunk(`title: "Clientes Cadastrados",
      value: !canSeeCRM ? 'Sem acesso' : !hasContextoAtivo ? 'Indisponível'
        : clientesCountPending ? 'Carregando' : totalClientes ?? 'Indisponível',`, `title: "Clientes Ativos",
      value: clientesAtivos,`);
  return text;
}
