import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Package, AlertCircle } from "lucide-react";
import useContextoVisual from "@/components/lib/useContextoVisual";
import { readErpHttpSession } from "@/api/erpHttpSession";
import { central360SessionKey } from "@/api/httpApiClient";
import {
  buildFechamentoQueryKey,
  isFechamentoScopeCurrent,
} from "@/components/comercial/fechamentoCacheScope";

function readFechamentoActorAndSession() {
  const session = readErpHttpSession();
  const actorId = typeof session?.actorId === 'string' ? session.actorId.trim() : '';
  return {
    actorId: actorId || null,
    sessionKey: central360SessionKey(session?.token),
  };
}

export default function BitolasDisponiveis({ value, onChange, label = "Bitola", tipo = "aco" }) {
  const { empresaAtual, grupoAtual, filterInContext } = useContextoVisual();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = empresaAtual?.id || null;
  const { actorId, sessionKey } = readFechamentoActorAndSession();
  const contextoValido = Boolean(groupId || empresaId);
  const scopeExpected = { actorId, sessionKey };

  // Escopo multiempresa: Produto via filterInContext (não list unscoped).
  // Cache: Grupo+Empresa+ator+sessão+tipo.
  const { data: produtos = [], isLoading, isError: isErrorBitolas } = useQuery({
    queryKey: buildFechamentoQueryKey('produtos-bitolas', { groupId, empresaId, actorId, sessionKey, extra: tipo }),
    queryFn: async ({ signal }) => {
      const allProdutos = await filterInContext('Produto', { status: 'Ativo' }, 'descricao', 500);
      if (signal?.aborted) {
        const err = new Error('BITOLAS_ABORTED');
        err.name = 'AbortError';
        throw err;
      }
      if (!isFechamentoScopeCurrent(scopeExpected, readFechamentoActorAndSession())) {
        throw new Error('BITOLAS_STALE_SCOPE');
      }

      // Filtrar apenas bitolas ativas
      // Critério: grupo = "Bitola" ou "Aço" ou "Ferro" E status = "Ativo"
      return allProdutos.filter(p => {
        const grupoMatch = p.grupo &&
          (p.grupo.toLowerCase().includes('bitola') ||
           p.grupo.toLowerCase().includes('aço') ||
           p.grupo.toLowerCase().includes('aco') ||
           p.grupo.toLowerCase().includes('ferro'));

        const statusAtivo = p.status === 'Ativo';

        // Filtrar por tipo se necessário
        let tipoMatch = true;
        if (tipo === 'aco') {
          // Bitolas de aço (6.3mm, 8.0mm, 10.0mm, 12.5mm, 16.0mm, 20.0mm, 25.0mm, 32.0mm)
          tipoMatch = p.descricao && (
            p.descricao.includes('6.3') ||
            p.descricao.includes('8.0') ||
            p.descricao.includes('10.0') ||
            p.descricao.includes('12.5') ||
            p.descricao.includes('16.0') ||
            p.descricao.includes('20.0') ||
            p.descricao.includes('25.0') ||
            p.descricao.includes('32.0')
          );
        } else if (tipo === 'estribo') {
          // Bitolas de estribo (4.2mm, 5.0mm, 6.3mm)
          tipoMatch = p.descricao && (
            p.descricao.includes('4.2') ||
            p.descricao.includes('5.0') ||
            p.descricao.includes('6.3')
          );
        }

        return grupoMatch && statusAtivo && tipoMatch;
      });
    },
    enabled: contextoValido,
    staleTime: 60000, // Cache de 1 minuto
  });

  // Ordenar por bitola (do menor para o maior)
  const bitolasSorted = [...produtos].sort((a, b) => {
    const bitolaA = parseFloat(a.descricao?.match(/(\d+\.\d+)/)?.[0] || 0);
    const bitolaB = parseFloat(b.descricao?.match(/(\d+\.\d+)/)?.[0] || 0);
    return bitolaA - bitolaB;
  });

  if (!contextoValido) {
    return (
      <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-900">
        Selecione grupo ou empresa para listar bitolas.
      </div>
    );
  }

  if (isErrorBitolas) {
    return (
      <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600">
        Bitolas indisponíveis (erro de carga ≠ zero).
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-3 bg-slate-50 rounded border animate-pulse">
        <div className="h-4 bg-slate-200 rounded w-32 mb-2"></div>
        <div className="h-10 bg-slate-200 rounded"></div>
      </div>
    );
  }

  if (produtos.length === 0) {
    return (
      <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-orange-900 mb-1">⚠️ Nenhuma Bitola Cadastrada</p>
            <p className="text-sm text-orange-800">
              Para usar a produção, você precisa cadastrar bitolas no módulo <strong>Estoque e Almoxarifado</strong>.
            </p>
            <p className="text-sm text-orange-700 mt-2">
              <strong>Como cadastrar:</strong>
            </p>
            <ol className="text-sm text-orange-700 list-decimal list-inside mt-1 space-y-1">
              <li>Vá em <strong>Estoque → Produtos</strong></li>
              <li>Adicione produtos com grupo <strong>"Bitola"</strong> ou <strong>"Aço"</strong></li>
              <li>Descrição: "Aço CA-50 6.3mm", "Aço CA-50 10.0mm", etc.</li>
              <li>Status: <strong>Ativo</strong></li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {label && (
        <label className="text-sm font-medium mb-2 block flex items-center gap-2">
          <Package className="w-4 h-4 text-slate-500" />
          {label}
          <Badge variant="outline" className="ml-auto text-xs">
            {produtos.length} disponíveis
          </Badge>
        </label>
      )}
      
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder={`Selecione ${tipo === 'aco' ? 'bitola do aço' : 'bitola do estribo'}`} />
        </SelectTrigger>
        <SelectContent>
          {bitolasSorted.map((produto) => {
            const bitolaMatch = produto.descricao?.match(/(\d+\.\d+)/);
            const bitola = bitolaMatch ? bitolaMatch[0] : produto.descricao;
            
            return (
              <SelectItem key={produto.id} value={produto.id}>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{bitola}mm</span>
                  <span className="text-xs text-slate-500">|</span>
                  <span className="text-xs text-slate-500">{produto.codigo}</span>
                  {produto.estoque_atual <= produto.estoque_minimo && (
                    <Badge variant="outline" className="text-xs text-orange-600 border-orange-300">
                      Estoque Baixo
                    </Badge>
                  )}
                </div>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>

      {value && (
        <div className="mt-2 p-2 bg-blue-50 rounded border border-blue-200">
          {(() => {
            const produtoSelecionado = produtos.find(p => p.id === value);
            if (!produtoSelecionado) return null;
            
            return (
              <div className="flex items-center justify-between text-xs">
                <div>
                  <p className="text-slate-600">Estoque: <strong className="text-slate-900">{produtoSelecionado.estoque_atual || 0} {produtoSelecionado.unidade_medida}</strong></p>
                  <p className="text-slate-600">Custo: <strong className="text-slate-900">R$ {(produtoSelecionado.custo_aquisicao || 0).toFixed(2)}/{produtoSelecionado.unidade_medida}</strong></p>
                </div>
                {produtoSelecionado.fornecedor_principal && (
                  <p className="text-slate-500">Fornecedor: {produtoSelecionado.fornecedor_principal}</p>
                )}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}