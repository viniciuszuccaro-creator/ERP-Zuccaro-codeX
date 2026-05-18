import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useWindow } from "@/components/lib/useWindow";
import usePermissions from "@/components/lib/usePermissions";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import { useUser } from "@/components/lib/UserContext";
import { useToast } from "@/components/ui/use-toast";
import { base44 } from "@/api/base44Client";
import VisualizadorUniversalEntidadeV24 from "@/components/cadastros/VisualizadorUniversalEntidadeV24";
import { Landmark, CreditCard, Wallet, Calculator, FolderKanban, Banknote, LineChart, Layers, BookText, DollarSign, Settings, Blocks } from "lucide-react";
import CountBadgeSimplificado from "@/components/cadastros/CountBadgeSimplificado";

import BancoForm from "@/components/cadastros/BancoForm";
import FormaPagamentoFormCompleto from "@/components/cadastros/FormaPagamentoFormCompleto";
import ConfiguracaoDespesaRecorrenteForm from "@/components/cadastros/ConfiguracaoDespesaRecorrenteForm";
import TabelaFiscalForm from "@/components/cadastros/TabelaFiscalForm";
import CondicaoComercialForm from "@/components/cadastros/CondicaoComercialForm";
import CentroCustoForm from "@/components/cadastros/CentroCustoForm";
import CentroResultadoForm from "@/components/cadastros/CentroResultadoForm";
import PlanoContasForm from "@/components/cadastros/PlanoContasForm";
import TipoDespesaForm from "@/components/cadastros/TipoDespesaForm";
import MoedaIndiceForm from "@/components/cadastros/MoedaIndiceForm";
import OperadorCaixaForm from "@/components/cadastros/OperadorCaixaForm";

function filterTiles(tiles, searchTerm) {
  const q = String(searchTerm || "").trim().toLowerCase();
  if (!q) return tiles;
  return tiles.filter(({ k, t }) => `${k} ${t}`.toLowerCase().includes(q));
}

export default function Bloco3Financeiro({ allCounts, isLoading, searchTerm = "" }) {
  const { openWindow } = useWindow();
  const { hasPermission } = usePermissions();
  const { empresaAtual, grupoAtual } = useContextoVisual();
  const { user } = useUser();
  const { toast } = useToast();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = empresaAtual?.id || null;
  const contextoValido = Boolean(groupId || empresaId);

  const registrarAuditoria = async (entidade, acao, sucesso = true) => {
    try {
      await base44.entities.AuditLog.create({
        usuario_id: user?.id,
        usuario: user?.full_name || user?.email || "Usuario",
        acao,
        modulo: "Cadastros",
        entidade,
        tipo_auditoria: sucesso ? "acesso" : "seguranca",
        descricao: `${acao} em cadastro financeiro/fiscal: ${entidade}`,
        empresa_id: empresaId,
        group_id: groupId,
        grupo_id: groupId,
        dados_novos: { bloco: "Financeiro & Fiscal", entidade },
        data_hora: new Date().toISOString(),
        sucesso,
      });
    } catch (_) {}
  };

  const openList = (entidade, titulo, Icon, campos, FormComp) => () => {
    if (!contextoValido) {
      toast({
        title: "Selecione grupo ou empresa",
        description: "Cadastros financeiros e fiscais precisam de contexto ativo para abrir.",
        variant: "destructive",
      });
      registrarAuditoria(entidade, "Bloqueio sem contexto", false);
      return;
    }
    if (!canViewEntity(entidade)) {
      toast({
        title: "Acesso negado",
        description: "Seu perfil nao possui permissao para visualizar este cadastro.",
        variant: "destructive",
      });
      registrarAuditoria(entidade, "Bloqueio por permissao", false);
      return;
    }
    registrarAuditoria(entidade, "Visualizacao");
    openWindow(
      VisualizadorUniversalEntidadeV24,
      { nomeEntidade: entidade, tituloDisplay: titulo, icone: Icon, camposPrincipais: campos, componenteEdicao: FormComp, windowMode: true },
      { title: titulo, width: 1400, height: 800 }
    );
  };

  const tiles = [
    { k: 'Banco',                         t: 'Bancos',                  i: Landmark,     c: ['nome','nome_banco','codigo_banco','agencia'],             f: BancoForm },
    { k: 'FormaPagamento',                t: 'Formas de Pagamento',     i: CreditCard,   c: ['nome','tipo','descricao','ativo'],                        f: FormaPagamentoFormCompleto },
    { k: 'PlanoDeContas',                 t: 'Plano de Contas',         i: BookText,     c: ['nome','nome_conta','codigo','codigo_conta','tipo_conta'], f: PlanoContasForm },
    { k: 'CentroCusto',                   t: 'Centros de Custo',        i: Layers,       c: ['nome','descricao','codigo','tipo'],                       f: CentroCustoForm },
    { k: 'CentroResultado',               t: 'Centros de Resultado',    i: LineChart,    c: ['nome','codigo','descricao'],                              f: CentroResultadoForm },
    { k: 'TipoDespesa',                   t: 'Tipos de Despesa',        i: FolderKanban, c: ['nome','codigo','categoria'],                              f: TipoDespesaForm },
    { k: 'MoedaIndice',                   t: 'Moedas & Índices',        i: DollarSign,   c: ['nome','tipo','sigla','codigo'],                           f: MoedaIndiceForm },
    { k: 'OperadorCaixa',                 t: 'Operadores de Caixa',     i: Wallet,       c: ['nome','nome_caixa','codigo_operador','ativo'],            f: OperadorCaixaForm },
    { k: 'ConfiguracaoDespesaRecorrente', t: 'Despesas Recorrentes',    i: Calculator,   c: ['nome','descricao','periodicidade','ativo'],               f: ConfiguracaoDespesaRecorrenteForm },
    { k: 'TabelaFiscal',                  t: 'Tabelas Fiscais',         i: Blocks,       c: ['nome','nome_regra','cfop','regime_tributario'],           f: TabelaFiscalForm },
    { k: 'CondicaoComercial',             t: 'Condições Comerciais',    i: Banknote,     c: ['nome','nome_condicao','forma_pagamento','ativo'],         f: CondicaoComercialForm },
  ];
  const filteredTiles = filterTiles(tiles, searchTerm);

  const canViewEntity = (entidade) =>
    hasPermission("Cadastros", entidade, "visualizar") ||
    hasPermission("Cadastros", null, "visualizar") ||
    hasPermission("Financeiro", entidade, "visualizar") ||
    hasPermission("Financeiro", null, "visualizar");

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
      <Card className="rounded-sm shadow-sm border bg-white/80 backdrop-blur">
        <CardHeader className="bg-gradient-to-r from-emerald-50 to-teal-50 border-b rounded-t-sm">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Landmark className="w-5 h-5 text-emerald-700" /> Financeiro & Fiscal
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-4 text-sm text-slate-600">
          {contextoValido ? "Total consolidado do grupo/empresa." : "Selecione grupo ou empresa para abrir cadastros financeiros e fiscais."}
        </CardContent>
      </Card>

      {filteredTiles.map(({ k, t, i: Icon, c, f: FormComp }) => (
        <Card
          key={k}
          className="rounded-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-150 cursor-pointer group border"
          onClick={openList(k, t, Icon, c, FormComp)}
          data-permission={`Cadastros.${k}.visualizar`}
          data-action={`Cadastros.${k}.abrir`}
          data-context-required="group-or-company"
        >
          <CardHeader className="bg-gradient-to-r from-slate-50 to-white border-b pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 text-slate-700">
                <div className="p-1.5 rounded-sm bg-emerald-50 group-hover:bg-emerald-100 transition-colors">
                  <Icon className="w-4 h-4 text-emerald-600" />
                </div>
                {t}
                <CountBadgeSimplificado entities={[k]} allCounts={allCounts} isLoading={isLoading} />
              </CardTitle>
              <Button
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 rounded-sm text-xs h-7"
                onClick={(e) => { e.stopPropagation(); openList(k, t, Icon, c, FormComp)(); }}
                disabled={!contextoValido || !canViewEntity(k)}
                data-permission={`Cadastros.${k}.visualizar`}
                data-action={`Cadastros.${k}.abrir`}
                data-context-required="group-or-company"
              >
                Abrir
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-3 text-xs text-slate-500">Clique para listar, criar e editar.</CardContent>
        </Card>
      ))}
    </div>
  );
}
