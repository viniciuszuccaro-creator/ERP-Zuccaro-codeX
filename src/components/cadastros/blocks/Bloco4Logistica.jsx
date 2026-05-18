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
import { Truck, MapPin, Package, FileText, User, Settings } from "lucide-react";
import AppEntregasMotorista from "@/components/mobile/AppEntregasMotorista";
import CountBadgeSimplificado from "@/components/cadastros/CountBadgeSimplificado";

import VeiculoForm from "@/components/cadastros/VeiculoForm";
import MotoristaForm from "@/components/cadastros/MotoristaForm";
import TipoFreteForm from "@/components/cadastros/TipoFreteForm";
import LocalEstoqueForm from "@/components/cadastros/LocalEstoqueForm";
import RotaPadraoForm from "@/components/cadastros/RotaPadraoForm";
import ModeloDocumentoForm from "@/components/cadastros/ModeloDocumentoForm";

function filterTiles(tiles, searchTerm) {
  const q = String(searchTerm || "").trim().toLowerCase();
  if (!q) return tiles;
  return tiles.filter(({ k, t }) => `${k} ${t}`.toLowerCase().includes(q));
}

export default function Bloco4Logistica({ allCounts, isLoading, searchTerm = "" }) {
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
        descricao: `${acao} em cadastro logistico/frota/almoxarifado: ${entidade}`,
        empresa_id: empresaId,
        group_id: groupId,
        grupo_id: groupId,
        dados_novos: { bloco: "Logistica, Frotas & Almoxarifado", entidade },
        data_hora: new Date().toISOString(),
        sucesso,
      });
    } catch (_) {}
  };

  const openList = (entidade, titulo, Icon, campos, FormComp) => () => {
    if (!contextoValido) {
      toast({
        title: "Selecione grupo ou empresa",
        description: "Cadastros logisticos precisam de contexto ativo para abrir.",
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
    openWindow(VisualizadorUniversalEntidadeV24, { nomeEntidade: entidade, tituloDisplay: titulo, icone: Icon, camposPrincipais: campos, componenteEdicao: FormComp, windowMode: true }, { title: titulo, width: 1400, height: 800 });
  };

  // Campos reais das entidades — getDisplayValue faz fallback automático se vazio
  const tiles = [
    { k: 'Veiculo',         t: 'Veículos',                        i: Truck,    c: ['placa','modelo','tipo_veiculo','status'],     f: VeiculoForm },
    { k: 'Motorista',       t: 'Motoristas',                      i: User,     c: ['nome','nome_completo','cpf','status'],         f: MotoristaForm },
    { k: 'TipoFrete',       t: 'Tipos de Frete',                  i: Settings, c: ['nome','descricao','modalidade','cobra_frete'],f: TipoFreteForm },
    { k: 'LocalEstoque',    t: 'Locais de Estoque',               i: Package,  c: ['nome','descricao','codigo'],                  f: LocalEstoqueForm },
    { k: 'RotaPadrao',      t: 'Rotas Padrão',                    i: MapPin,   c: ['nome','nome_rota','origem','destino'],         f: RotaPadraoForm },
    { k: 'ModeloDocumento', t: 'Modelos de Documento Logístico',  i: FileText, c: ['nome','nome_modelo','tipo_documento','ativo'], f: ModeloDocumentoForm },
  ];
  const filteredTiles = filterTiles(tiles, searchTerm);
  const canViewEntity = (entidade) =>
    hasPermission("Cadastros", entidade, "visualizar") ||
    hasPermission("Cadastros", null, "visualizar") ||
    hasPermission("Expedicao", entidade, "visualizar") ||
    hasPermission("Expedicao", null, "visualizar") ||
    hasPermission("Expedição", entidade, "visualizar") ||
    hasPermission("Expedição", null, "visualizar");

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
      <Card className="rounded-sm shadow-sm border bg-white/80 backdrop-blur">
        <CardHeader className="bg-gradient-to-r from-sky-50 to-cyan-50 border-b rounded-t-sm">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Truck className="w-5 h-5 text-sky-700"/> Logística, Frotas & Almoxarifado
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-4 text-sm text-slate-600">
          {contextoValido ? "Total consolidado do grupo/empresa." : "Selecione grupo ou empresa para abrir cadastros logisticos."}
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
                <div className="p-1.5 rounded-sm bg-sky-50 group-hover:bg-sky-100 transition-colors">
                  <Icon className="w-4 h-4 text-sky-600" />
                </div>
                {t}
                <CountBadgeSimplificado entities={[k]} allCounts={allCounts} isLoading={isLoading} />
              </CardTitle>
              <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                {k === 'Motorista' && (
                  <Button variant="outline" size="sm" className="rounded-sm text-xs h-7"
                    onClick={() => openWindow(AppEntregasMotorista, {}, { title: 'App Motorista', width: 420, height: 800 })}
                    disabled={!contextoValido || !canViewEntity(k)}
                    data-permission="Cadastros.Motorista.visualizar"
                    data-action="Cadastros.Motorista.app"
                    data-context-required="group-or-company">
                    App
                  </Button>
                )}
                <Button size="sm" className="bg-blue-600 hover:bg-blue-700 rounded-sm text-xs h-7"
                  onClick={() => openList(k, t, Icon, c, FormComp)()}
                  disabled={!contextoValido || !canViewEntity(k)}
                  data-permission={`Cadastros.${k}.visualizar`}
                  data-action={`Cadastros.${k}.abrir`}
                  data-context-required="group-or-company">
                  Abrir
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-3 text-xs text-slate-500">Clique para listar, criar e editar.</CardContent>
        </Card>
      ))}
    </div>
  );
}
