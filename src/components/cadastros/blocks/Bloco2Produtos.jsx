import React, { useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useWindow } from "@/components/lib/useWindow";
import usePermissions from "@/components/lib/usePermissions";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import { useUser } from "@/components/lib/UserContext";
import { useToast } from "@/components/ui/use-toast";
import VisualizadorUniversalEntidadeV24 from "@/components/cadastros/VisualizadorUniversalEntidadeV24";
import VisualizadorProdutos from "@/components/cadastros/VisualizadorProdutos";
import { Package, Stars, Factory, Boxes, Award, TrendingUp, Globe, Ruler } from "lucide-react";
import CountBadgeSimplificado from "@/components/cadastros/CountBadgeSimplificado";

import ProdutoFormV22_Completo from "@/components/cadastros/ProdutoFormV22_Completo";
import ServicoForm from "@/components/cadastros/ServicoForm";
import SetorAtividadeForm from "@/components/cadastros/SetorAtividadeForm";
import GrupoProdutoForm from "@/components/cadastros/GrupoProdutoForm";
import MarcaForm from "@/components/cadastros/MarcaForm";
import TabelaPrecoFormCompleto from "@/components/cadastros/TabelaPrecoFormCompleto";
import KitProdutoForm from "@/components/cadastros/KitProdutoForm";
import CatalogoWebForm from "@/components/cadastros/CatalogoWebForm";
import UnidadeMedidaForm from "@/components/cadastros/UnidadeMedidaForm";

function filterTiles(tiles, searchTerm) {
  const q = String(searchTerm || "").trim().toLowerCase();
  if (!q) return tiles;
  return tiles.filter(({ k, title }) => `${k} ${title}`.toLowerCase().includes(q));
}

export default function Bloco2Produtos({ allCounts, isLoading, searchTerm = "" }) {
  const { openWindow } = useWindow();
  const { hasPermission } = usePermissions();
  const { empresaAtual, grupoAtual, createInContext } = useContextoVisual();
  const { user } = useUser();
  const { toast } = useToast();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = empresaAtual?.id || null;
  const contextoValido = Boolean(groupId || empresaId);

  const getTotalEntidade = (entidade) => Number(allCounts?.[entidade] || 0);

  const getDadosContexto = () => ({
    bloco: "Produtos & Servicos",
    contexto: grupoAtual?.id ? "grupo" : empresaAtual?.id ? "empresa" : "sem-contexto",
    contexto_valido: contextoValido,
    group_id: groupId,
    empresa_id: empresaId,
    empresa_nome: empresaAtual?.nome_fantasia || empresaAtual?.razao_social || null,
    grupo_nome: grupoAtual?.nome || grupoAtual?.nome_grupo || null,
  });

  const registrarAuditoria = async (entidade, acao, sucesso = true, extras = {}) => {
    try {
      await createInContext("AuditLog", {
        usuario_id: user?.id,
        usuario: user?.full_name || user?.email || "Usuario",
        acao,
        modulo: "Cadastros",
        entidade,
        tipo_auditoria: sucesso ? "acesso" : "seguranca",
        descricao: `${acao} em cadastro de produtos e servicos: ${entidade}`,
        empresa_id: empresaId,
        group_id: groupId,
        grupo_id: groupId,
        dados_novos: {
          ...getDadosContexto(),
          entidade,
          permissao: `Cadastros.${entidade}.visualizar`,
          total_entidade: getTotalEntidade(entidade),
          ...(extras || {}),
        },
        data_hora: new Date().toISOString(),
        sucesso,
      });
    } catch (_) {}
  };

  const openProdutos = () => {
    if (!contextoValido) {
      toast({
        title: "Selecione grupo ou empresa",
        description: "Cadastros de produtos e servicos precisam de contexto ativo para abrir.",
        variant: "destructive",
      });
      registrarAuditoria("Produto", "Bloqueio sem contexto", false, { motivo: "contexto_obrigatorio", titulo: "Todos os Produtos", modulo_permissao: "Estoque" });
      return;
    }
    if (!canViewEntity("Produto", "Estoque")) {
      toast({
        title: "Acesso negado",
        description: "Seu perfil nao possui permissao para visualizar produtos.",
        variant: "destructive",
      });
      registrarAuditoria("Produto", "Bloqueio por permissao", false, { motivo: "permissao_negada", titulo: "Todos os Produtos", modulo_permissao: "Estoque" });
      return;
    }
    registrarAuditoria("Produto", "Visualizacao", true, { titulo: "Todos os Produtos", modulo_permissao: "Estoque", visualizador: "VisualizadorProdutos", window_mode: true });
    openWindow(VisualizadorProdutos, { windowMode: true }, { title: 'Todos os Produtos', width: 1400, height: 800 });
  };

  const openList = (entidade, titulo, Icon, campos, FormComp) => () => {
    if (!contextoValido) {
      toast({
        title: "Selecione grupo ou empresa",
        description: "Cadastros de produtos e servicos precisam de contexto ativo para abrir.",
        variant: "destructive",
      });
      registrarAuditoria(entidade, "Bloqueio sem contexto", false, { motivo: "contexto_obrigatorio", titulo });
      return;
    }
    if (!canViewEntity(entidade)) {
      toast({
        title: "Acesso negado",
        description: "Seu perfil nao possui permissao para visualizar este cadastro.",
        variant: "destructive",
      });
      registrarAuditoria(entidade, "Bloqueio por permissao", false, { motivo: "permissao_negada", titulo });
      return;
    }
    registrarAuditoria(entidade, "Visualizacao", true, { titulo, campos_principais: campos, visualizador: "VisualizadorUniversalEntidadeV24", window_mode: true });
    openWindow(VisualizadorUniversalEntidadeV24, { nomeEntidade: entidade, tituloDisplay: titulo, icone: Icon, camposPrincipais: campos, componenteEdicao: FormComp, windowMode: true }, { title: titulo, width: 1400, height: 800 });
  };

  const canViewEntity = (entidade, modulo = "Cadastros") =>
    hasPermission("Cadastros", entidade, "visualizar") ||
    hasPermission("Cadastros", null, "visualizar") ||
    hasPermission(modulo, entidade, "visualizar") ||
    hasPermission(modulo, null, "visualizar");

  // ATENÇÃO: sempre usar o campo real que a entidade salva (não alias como nome_grupo, nome_marca etc.)
  // getDisplayValue no visualizador faz fallback automático se o campo estiver vazio
  const tiles = [
    { k: 'Servico',        title: 'Serviços',                Icon: Stars,      campos: ['nome','descricao','tipo_servico','ativo'],      form: ServicoForm },
    { k: 'SetorAtividade', title: 'Setores de Atividade',    Icon: Factory,    campos: ['nome','descricao','codigo'],                    form: SetorAtividadeForm },
    { k: 'GrupoProduto',   title: 'Grupos/Linhas de Produto', Icon: Boxes,     campos: ['nome','nome_grupo','codigo','natureza'],        form: GrupoProdutoForm },
    { k: 'Marca',          title: 'Marcas',                   Icon: Award,     campos: ['nome','nome_marca','pais_origem','categoria'],  form: MarcaForm },
    { k: 'TabelaPreco',    title: 'Tabelas de Preço',         Icon: TrendingUp,campos: ['nome','tipo','ativo'],                          form: TabelaPrecoFormCompleto },
    { k: 'KitProduto',     title: 'Kits de Produto',          Icon: Package,   campos: ['nome','descricao','ativo'],                     form: KitProdutoForm },
    { k: 'CatalogoWeb',    title: 'Catálogo Web',             Icon: Globe,     campos: ['nome','nome_catalogo','descricao','ativo'],      form: CatalogoWebForm },
    { k: 'UnidadeMedida',  title: 'Unidades de Medida',       Icon: Ruler,     campos: ['sigla','nome','descricao'],                     form: UnidadeMedidaForm },
  ];
  const filteredTiles = filterTiles(tiles, searchTerm);

  useEffect(() => {
    const termo = String(searchTerm || "").trim().replace(/\s+/g, " ").slice(0, 120);
    if (termo.length < 3) return;
    void registrarAuditoria("Bloco2Produtos", "Filtro aplicado", contextoValido, {
      termo,
      total_itens_bloco: tiles.length + 1,
      total_itens_filtrados: filteredTiles.length + 1,
      entidades_filtradas: ["Produto", ...filteredTiles.map(({ k }) => k)],
      motivo: contextoValido ? null : "contexto_obrigatorio",
    });
  }, [searchTerm, contextoValido, filteredTiles.length]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
      <Card className="rounded-sm shadow-sm border bg-white/80 backdrop-blur">
        <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 border-b rounded-t-sm">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="w-5 h-5 text-purple-700"/> Produtos & Serviços
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-4 text-sm text-slate-600">
          {contextoValido ? "Total consolidado do grupo/empresa." : "Selecione grupo ou empresa para abrir cadastros de produtos e servicos."}
        </CardContent>
      </Card>

      {/* Card Produtos (abre VisualizadorProdutos especializado) */}
      <Card className="rounded-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-150 cursor-pointer group border"
        onClick={openProdutos}
        data-permission="Cadastros.Produto.visualizar"
        data-action="Cadastros.Produto.abrir"
        data-context-required="group-or-company">
        <CardHeader className="bg-gradient-to-r from-slate-50 to-white border-b pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-slate-700">
              <div className="p-1.5 rounded-sm bg-purple-50 group-hover:bg-purple-100 transition-colors">
                <Package className="w-4 h-4 text-purple-600" />
              </div>
              Produtos
              <CountBadgeSimplificado entities={["Produto"]} allCounts={allCounts} isLoading={isLoading} />
            </CardTitle>
            <Button size="sm" className="bg-purple-600 hover:bg-purple-700 rounded-sm text-xs h-7"
              onClick={(e) => { e.stopPropagation(); openProdutos(); }}
              disabled={!contextoValido || !canViewEntity("Produto", "Estoque")}
              data-permission="Cadastros.Produto.visualizar"
              data-action="Cadastros.Produto.abrir"
              data-context-required="group-or-company">
              Abrir
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-3 text-xs text-slate-500">Listagem e edição completa com filtros avançados.</CardContent>
      </Card>

      {filteredTiles.map(({ k, title, Icon, campos, form: FormComp }) => (
        <Card key={k} className="rounded-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-150 cursor-pointer group border"
          onClick={openList(k, title, Icon, campos, FormComp)}
          data-permission={`Cadastros.${k}.visualizar`}
          data-action={`Cadastros.${k}.abrir`}
          data-context-required="group-or-company">
          <CardHeader className="bg-gradient-to-r from-slate-50 to-white border-b pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 text-slate-700">
                <div className="p-1.5 rounded-sm bg-purple-50 group-hover:bg-purple-100 transition-colors">
                  <Icon className="w-4 h-4 text-purple-600" />
                </div>
                {title}
                <CountBadgeSimplificado entities={[k]} allCounts={allCounts} isLoading={isLoading} />
              </CardTitle>
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700 rounded-sm text-xs h-7"
                onClick={(e) => { e.stopPropagation(); openList(k, title, Icon, campos, FormComp)(); }}
                disabled={!contextoValido || !canViewEntity(k)}
                data-permission={`Cadastros.${k}.visualizar`}
                data-action={`Cadastros.${k}.abrir`}
                data-context-required="group-or-company">
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
