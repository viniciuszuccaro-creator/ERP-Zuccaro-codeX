import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertCircle, DollarSign } from "lucide-react";
import useContextoVisual from "@/components/lib/useContextoVisual";
import { readErpHttpSession } from "@/api/erpHttpSession";
import { central360SessionKey } from "@/api/httpApiClient";
import {
  buildAplicadorTabelaQueryKey,
  isAplicadorTabelaScopeCurrent,
} from "./aplicadorTabelaScope";

function readAplicadorActorAndSession() {
  const session = readErpHttpSession();
  const actorId = typeof session?.actorId === 'string' ? session.actorId.trim() : '';
  return {
    actorId: actorId || null,
    sessionKey: central360SessionKey(session?.token),
  };
}

/**
 * Componente que gerencia aplicação de tabela de preço
 * - Carrega tabela padrão do cliente
 * - Permite trocar tabela manualmente
 * - Registra alterações no histórico
 */
export default function AplicadorTabelaPreco({ 
  cliente, 
  tabelaSelecionada, 
  onTabelaChange,
  onHistoricoAdd 
}) {
  const [tabelaAlteradaManualmente, setTabelaAlteradaManualmente] = useState(false);
  const { empresaAtual, grupoAtual, filterInContext } = useContextoVisual();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = empresaAtual?.id || null;
  const { actorId, sessionKey } = readAplicadorActorAndSession();
  const contextoValido = Boolean(groupId || empresaId);
  const scopeExpected = { actorId, sessionKey };

  // Escopo multiempresa: TabelaPreco via filterInContext (sem list unscoped).
  // Cache ator/sessão/Grupo/Empresa; sem initialData vazio.
  const {
    data: tabelas,
    isLoading,
    isError,
    isFetching,
  } = useQuery({
    queryKey: buildAplicadorTabelaQueryKey({ groupId, empresaId, actorId, sessionKey }),
    queryFn: async ({ signal }) => {
      const rows = await filterInContext('TabelaPreco', {}, 'nome', 500);
      if (signal?.aborted) {
        const err = new Error('APLICADOR_TABELA_ABORTED');
        err.name = 'AbortError';
        throw err;
      }
      if (!isAplicadorTabelaScopeCurrent(scopeExpected, readAplicadorActorAndSession())) {
        throw new Error('APLICADOR_TABELA_STALE_SCOPE');
      }
      return rows;
    },
    enabled: contextoValido,
  });

  const listaTabelas = Array.isArray(tabelas) ? tabelas : [];
  const tabelasIndisponiveis = !contextoValido || isLoading || isError || (isFetching && tabelas === undefined);

  const tabelasVigentes = tabelasIndisponiveis
    ? []
    : listaTabelas.filter(t => {
      if (!t.ativo) return false;
      const hoje = new Date();
      if (t.data_fim && new Date(t.data_fim) < hoje) return false;
      return true;
    });

  // Carregar tabela padrão do cliente
  useEffect(() => {
    if (!contextoValido || tabelasIndisponiveis) return;
    if (cliente?.condicao_comercial?.tabela_preco_id && !tabelaSelecionada && !tabelaAlteradaManualmente) {
      const tabelaPadrao = listaTabelas.find(t => t.id === cliente.condicao_comercial.tabela_preco_id);
      if (tabelaPadrao) {
        onTabelaChange(tabelaPadrao);
        if (onHistoricoAdd) {
          onHistoricoAdd({
            acao: "tabela_aplicada_automaticamente",
            campo: "tabela_preco_id",
            valor_novo: tabelaPadrao.id,
            observacao: `Tabela "${tabelaPadrao.nome}" aplicada automaticamente do cadastro do cliente`
          });
        }
      }
    }
  }, [cliente, listaTabelas, contextoValido, tabelasIndisponiveis, tabelaSelecionada, tabelaAlteradaManualmente, onTabelaChange, onHistoricoAdd]);

  const handleTrocarTabela = (tabelaId) => {
    if (tabelasIndisponiveis) return;
    const novaTabela = listaTabelas.find(t => t.id === tabelaId);
    if (novaTabela) {
      setTabelaAlteradaManualmente(true);
      onTabelaChange(novaTabela);
      if (onHistoricoAdd) {
        onHistoricoAdd({
          acao: "tabela_trocada",
          campo: "tabela_preco_id",
          valor_anterior: tabelaSelecionada?.id || null,
          valor_novo: novaTabela.id,
          observacao: `Tabela alterada manualmente de "${tabelaSelecionada?.nome || 'Nenhuma'}" para "${novaTabela.nome}"`
        });
      }
    }
  };

  const handleRemoverTabela = () => {
    setTabelaAlteradaManualmente(true);
    onTabelaChange(null);
    if (onHistoricoAdd) {
      onHistoricoAdd({
        acao: "tabela_removida",
        campo: "tabela_preco_id",
        valor_anterior: tabelaSelecionada?.id || null,
        valor_novo: null,
        observacao: "Tabela de preço removida - usando preço base do produto"
      });
    }
  };

  if (!cliente) return null;

  if (!contextoValido) {
    return (
      <Card className="border-amber-300 bg-amber-50">
        <CardContent className="p-3 text-sm text-amber-900">
          Selecione grupo ou empresa para aplicar tabela de preço.
        </CardContent>
      </Card>
    );
  }

  const temTabelaPadrao = cliente?.condicao_comercial?.tabela_preco_id;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>Tabela de Preço</Label>
        {tabelaSelecionada && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleRemoverTabela}
            className="text-xs text-red-600 hover:text-red-700"
          >
            Remover Tabela
          </Button>
        )}
      </div>

      {isError && (
        <p className="text-xs text-slate-500">Tabelas indisponíveis (erro de carga ≠ zero).</p>
      )}
      {isLoading && (
        <p className="text-xs text-slate-500">Carregando tabelas…</p>
      )}

      {!temTabelaPadrao && !tabelaSelecionada && !tabelasIndisponiveis && (
        <Card className="border-orange-300 bg-orange-50">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-orange-600" />
              <div>
                <p className="text-sm font-medium text-orange-900">
                  Cliente sem tabela de preço definida
                </p>
                <p className="text-xs text-orange-700">
                  Usando preço base do produto. Selecione uma tabela abaixo se necessário.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Select
        value={tabelaSelecionada?.id || ""}
        onValueChange={handleTrocarTabela}
        disabled={tabelasIndisponiveis}
      >
        <SelectTrigger>
          <SelectValue placeholder={tabelasIndisponiveis ? "Tabelas indisponíveis…" : "Selecione uma tabela de preço..."} />
        </SelectTrigger>
        <SelectContent>
          {tabelasVigentes.map(tabela => (
            <SelectItem key={tabela.id} value={tabela.id}>
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-green-600" />
                <div>
                  <p className="font-medium">{tabela.nome}</p>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">{tabela.tipo}</Badge>
                    {tabela.id === cliente?.condicao_comercial?.tabela_preco_id && (
                      <Badge className="bg-blue-600 text-xs">Padrão do Cliente</Badge>
                    )}
                  </div>
                </div>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {tabelaSelecionada && (
        <Card className="border-0 shadow-sm bg-green-50">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-green-600" />
                <div>
                  <p className="font-semibold text-green-900">{tabelaSelecionada.nome}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-xs">{tabelaSelecionada.tipo}</Badge>
                    <span className="text-xs text-green-700">
                      {tabelaSelecionada.quantidade_produtos || 0} produtos
                    </span>
                    {tabelaAlteradaManualmente && (
                      <Badge className="bg-orange-600 text-xs">Alterada Manualmente</Badge>
                    )}
                  </div>
                </div>
              </div>
              {tabelaSelecionada.data_fim && (
                <div className="text-right">
                  <p className="text-xs text-green-700">Válida até:</p>
                  <p className="text-xs font-semibold text-green-900">
                    {new Date(tabelaSelecionada.data_fim).toLocaleDateString('pt-BR')}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
