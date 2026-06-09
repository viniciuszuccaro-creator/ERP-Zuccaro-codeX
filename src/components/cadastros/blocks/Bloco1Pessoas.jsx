import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useWindow } from "@/components/lib/useWindow";
import usePermissions from "@/components/lib/usePermissions";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import { useUser } from "@/components/lib/UserContext";
import { useToast } from "@/components/ui/use-toast";
import VisualizadorUniversalEntidadeV24 from "@/components/cadastros/VisualizadorUniversalEntidadeV24";
import { Users, Building2, Truck, User, Award, MessageCircle, TrendingUp, MapPin } from "lucide-react";
import CountBadgeSimplificado from "@/components/cadastros/CountBadgeSimplificado";

import CadastroClienteCompleto from "@/components/cadastros/CadastroClienteCompleto";
import CadastroFornecedorCompleto from "@/components/cadastros/CadastroFornecedorCompleto";
import TransportadoraForm from "@/components/cadastros/TransportadoraForm";
import ColaboradorForm from "@/components/rh/ColaboradorForm";
import RepresentanteFormCompleto from "@/components/cadastros/RepresentanteFormCompleto";
import ContatoB2BForm from "@/components/cadastros/ContatoB2BForm";
import SegmentoClienteForm from "@/components/cadastros/SegmentoClienteForm";
import RegiaoAtendimentoForm from "@/components/cadastros/RegiaoAtendimentoForm";

function filterTiles(tiles, searchTerm) {
  const q = String(searchTerm || "").trim().toLowerCase();
  if (!q) return tiles;
  return tiles.filter(({ k, t }) => `${k} ${t}`.toLowerCase().includes(q));
}

export default function Bloco1Pessoas({ allCounts, isLoading, searchTerm = "" }) {
  const { openWindow } = useWindow();
  const { hasPermission } = usePermissions();
  const { empresaAtual, grupoAtual, createInContext } = useContextoVisual();
  const { user } = useUser();
  const { toast } = useToast();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = empresaAtual?.id || null;
  const contextoValido = Boolean(groupId || empresaId);

  const canViewEntity = (entidade) => (
    hasPermission('Cadastros', entidade, 'visualizar') || hasPermission('Cadastros', null, 'visualizar')
  );

  const registrarAuditoria = async (entidade, acao, sucesso = true) => {
    try {
      await createInContext("AuditLog", {
        usuario_id: user?.id,
        usuario: user?.full_name || user?.email || "Usuario",
        acao,
        modulo: "Cadastros",
        entidade,
        tipo_auditoria: sucesso ? "acesso" : "seguranca",
        descricao: `${acao} em cadastro de pessoas e parceiros: ${entidade}`,
        empresa_id: empresaId,
        group_id: groupId,
        grupo_id: groupId,
        dados_novos: { bloco: "Pessoas & Parceiros", entidade },
        data_hora: new Date().toISOString(),
        sucesso,
      });
    } catch (_) {}
  };

  const openList = (entidade, titulo, Icon, campos, FormComp) => () => {
    if (!contextoValido) {
      toast({
        title: "Selecione grupo ou empresa",
        description: "Cadastros de pessoas e parceiros precisam de contexto ativo para abrir.",
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
      {
        nomeEntidade: entidade,
        tituloDisplay: titulo,
        icone: Icon,
        camposPrincipais: campos,
        componenteEdicao: FormComp,
        windowMode: true,
      },
      { title: titulo, width: 1400, height: 800 }
    );
  };

  const tiles = [
    { k: 'Cliente',           t: 'Clientes',                    i: Users,         c: ['nome','razao_social','cnpj','status','tipo'],                        f: CadastroClienteCompleto },
    { k: 'Fornecedor',        t: 'Fornecedores',                i: Building2,     c: ['nome','razao_social','cnpj','categoria','status_fornecedor'],         f: CadastroFornecedorCompleto },
    { k: 'Transportadora',    t: 'Transportadoras',             i: Truck,         c: ['razao_social','nome_fantasia','cnpj','cidade','status'],              f: TransportadoraForm },
    { k: 'Colaborador',       t: 'Colaboradores',               i: User,          c: ['nome_completo','cargo','departamento','tipo_contrato','status'],      f: ColaboradorForm },
    { k: 'Representante',     t: 'Representantes & Indicadores',i: Award,         c: ['nome','email','telefone','percentual_comissao'],                      f: RepresentanteFormCompleto },
    { k: 'ContatoB2B',        t: 'Contatos B2B',                i: MessageCircle, c: ['nome','cargo','email','telefone'],                                    f: ContatoB2BForm },
    { k: 'SegmentoCliente',   t: 'Segmentos de Cliente',        i: TrendingUp,    c: ['nome','descricao','tipo'],                                            f: SegmentoClienteForm },
    { k: 'RegiaoAtendimento', t: 'Regiões de Atendimento',      i: MapPin,        c: ['nome','descricao','tipo'],                                            f: RegiaoAtendimentoForm },
  ];
  const filteredTiles = filterTiles(tiles, searchTerm);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
      <Card className="rounded-sm shadow-sm border bg-white/80 backdrop-blur">
        <CardHeader className="bg-gradient-to-r from-blue-50 to-purple-50 border-b rounded-t-sm">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-700" /> Pessoas & Parceiros
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-4 text-sm text-slate-600">
          {contextoValido ? "Total consolidado do grupo/empresa." : "Selecione grupo ou empresa para abrir cadastros de pessoas e parceiros."}
        </CardContent>
      </Card>

      {filteredTiles.map(({ k, t, i: Icon, c, f: FormComp }) => (
        <Card key={k} className="rounded-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-150 cursor-pointer group border"
          onClick={openList(k, t, Icon, c, FormComp)}
          data-permission={`Cadastros.${k}.visualizar`}
          data-action={`Cadastros.${k}.abrir`}
          data-context-required="group-or-company">
          <CardHeader className="bg-gradient-to-r from-slate-50 to-white border-b pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 text-slate-700">
                <div className="p-1.5 rounded-sm bg-blue-50 group-hover:bg-blue-100 transition-colors">
                  <Icon className="w-4 h-4 text-blue-600" />
                </div>
                {t}
                <CountBadgeSimplificado entities={[k]} allCounts={allCounts} isLoading={isLoading} />
              </CardTitle>
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700 rounded-sm text-xs h-7"
                onClick={(e) => { e.stopPropagation(); openList(k, t, Icon, c, FormComp)(); }}
                disabled={!contextoValido || !canViewEntity(k)}
                data-permission={`Cadastros.${k}.visualizar`}
                data-action={`Cadastros.${k}.abrir`}
                data-context-required="group-or-company">
                Abrir
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-3 text-xs text-slate-500">
            Clique para listar, criar e editar em janela flutuante.
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
