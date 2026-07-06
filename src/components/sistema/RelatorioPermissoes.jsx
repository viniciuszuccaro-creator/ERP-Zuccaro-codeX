import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, FileText, Eye, Shield, Users, Building2 } from "lucide-react";
import { toast } from "sonner";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";

export default function RelatorioPermissoes({ perfis = [], usuarios = [], empresas = [] }) {
  const { empresaAtual, grupoAtual, contexto, empresasDoGrupo = [], createInContext } = useContextoVisual();
  const { user, isAdmin, hasPermission } = usePermissions();
  const grupoId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = contexto === "grupo" ? null : empresaAtual?.id || null;
  const contextoValido = contexto === "grupo" ? Boolean(grupoId) : Boolean(grupoId && empresaId);
  const empresasGrupoIds = (empresasDoGrupo.length ? empresasDoGrupo : empresas)
    .map((empresa) => (typeof empresa === "string" ? empresa : empresa?.empresa_id || empresa?.id))
    .filter(Boolean);
  const podeExportar = isAdmin() || hasPermission("Sistema", "Controle de Acesso", "exportar");
  const mensagemContextoObrigatorio = contexto === "grupo"
    ? "Selecione um grupo antes de exportar relatorio de permissoes."
    : "Selecione uma empresa vinculada a um grupo antes de exportar relatorio de permissoes.";

  const getResumoContexto = () => ({
    contexto: contexto || "sem-contexto",
    contexto_valido: contextoValido,
    group_id: grupoId,
    empresa_id: empresaId,
    empresas_grupo_ids: empresasGrupoIds,
    empresas_grupo_total: empresasGrupoIds.length,
    empresa_nome: empresaAtual?.nome_fantasia || empresaAtual?.razao_social || null,
    grupo_nome: grupoAtual?.nome || grupoAtual?.nome_grupo || null,
  });

  const auditarRelatorio = async ({ formato, resumo, sucesso = true, descricao, motivo }) => {
    try {
      await createInContext('AuditLog', {
        usuario: user?.full_name || user?.email || "Sistema",
        usuario_id: user?.id || null,
        group_id: grupoId,
        empresa_id: empresaId,
        acao: sucesso ? "Exportacao" : "Bloqueio Exportacao",
        modulo: "Controle de Acesso",
        entidade: "RelatorioPermissoes",
        descricao: descricao || `Exportacao de relatorio de permissoes em ${formato}`,
        dados_novos: {
          ...getResumoContexto(),
          formato,
          motivo: motivo || null,
          ...(resumo || {}),
        },
        sucesso,
        data_hora: new Date().toISOString(),
      });
    } catch (error) {
      console.warn("[RBAC] Falha ao auditar relatorio de permissoes:", error);
    }
  };

  const bloquearExportacao = (motivo, mensagem) => {
    toast.error(mensagem);
    void auditarRelatorio({
      formato: "bloqueado",
      sucesso: false,
      motivo,
      descricao: mensagem,
      resumo: {
        total_perfis: perfis.length,
        total_usuarios: usuarios.length,
        total_empresas: empresas.length,
      },
    });
  };
  const gerarRelatorio = () => {
    if (!contextoValido) {
      bloquearExportacao("contexto_obrigatorio", mensagemContextoObrigatorio);
      return;
    }
    if (!podeExportar) {
      bloquearExportacao("permissao_negada", "Sem permissao para exportar relatorio de permissoes.");
      return;
    }

    const relatorio = {
      data_geracao: new Date().toISOString(),
      contexto: getResumoContexto(),
      resumo: {
        total_perfis: perfis.length,
        total_usuarios: usuarios.length,
        total_empresas: empresas.length,
        empresas_grupo_total: empresasGrupoIds.length,
        usuarios_sem_perfil: usuarios.filter(u => !u.perfil_acesso_id).length
      },
      perfis: perfis.map(p => ({
        id: p.id,
        nome: p.nome_perfil,
        nivel: p.nivel_perfil,
        group_id: p.group_id || p.grupo_id || grupoId,
        empresa_id: p.empresa_id || null,
        empresas_grupo_ids: p.empresas_grupo_ids || empresasGrupoIds,
        usuarios_vinculados: usuarios.filter(u => u.perfil_acesso_id === p.id).length,
        conflitos_sod: p.conflitos_sod_detectados?.length || 0,
        ativo: p.ativo
      })),
      usuarios: usuarios.map(u => ({
        id: u.id,
        nome: u.full_name,
        email: u.email,
        group_id: u.group_id || u.grupo_id || u.grupo_atual_id || grupoId,
        empresa_id: u.empresa_id || u.empresa_atual_id || null,
        perfil: perfis.find(p => p.id === u.perfil_acesso_id)?.nome_perfil || "Sem perfil",
        empresas: u.empresas_vinculadas?.length || 0,
        empresas_vinculadas: u.empresas_vinculadas || [],
        role: u.role
      }))
    };

    const blob = new Blob([JSON.stringify(relatorio, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio-permissoes-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    void auditarRelatorio({ formato: "JSON", resumo: relatorio.resumo });
    
    toast.success("Relatório exportado!");
  };

  const gerarRelatorioSimplificado = () => {
    if (!contextoValido) {
      bloquearExportacao("contexto_obrigatorio", mensagemContextoObrigatorio);
      return;
    }
    if (!podeExportar) {
      bloquearExportacao("permissao_negada", "Sem permissao para exportar relatorio de permissoes.");
      return;
    }

    let texto = `RELATÓRIO DE PERMISSÕES E ACESSOS\n`;
    texto += `Gerado em: ${new Date().toLocaleString('pt-BR')}\n\n`;
    texto += `Contexto: ${contexto || "sem-contexto"}\n`;
    texto += `Contexto valido: ${contextoValido ? "sim" : "nao"}\n`;
    texto += `GroupId: ${grupoId || "-"}\n`;
    texto += `EmpresaId: ${empresaId || "-"}\n\n`;
    texto += `Empresas do grupo: ${empresasGrupoIds.length}\n\n`;
    texto += `====================\n`;
    texto += `RESUMO GERAL\n`;
    texto += `====================\n`;
    texto += `Total de Perfis: ${perfis.length}\n`;
    texto += `Total de Usuários: ${usuarios.length}\n`;
    texto += `Usuários sem Perfil: ${usuarios.filter(u => !u.perfil_acesso_id).length}\n\n`;

    texto += `====================\n`;
    texto += `PERFIS DE ACESSO\n`;
    texto += `====================\n`;
    perfis.forEach(p => {
      texto += `\n${p.nome_perfil} (${p.nivel_perfil})\n`;
      texto += `  GroupId: ${p.group_id || p.grupo_id || grupoId || "-"}\n`;
      texto += `  EmpresaId: ${p.empresa_id || "-"}\n`;
      texto += `  Status: ${p.ativo ? 'Ativo' : 'Inativo'}\n`;
      texto += `  Usuários: ${usuarios.filter(u => u.perfil_acesso_id === p.id).length}\n`;
      texto += `  Conflitos SoD: ${p.conflitos_sod_detectados?.length || 0}\n`;
    });

    texto += `\n====================\n`;
    texto += `USUÁRIOS E PERFIS\n`;
    texto += `====================\n`;
    usuarios.forEach(u => {
      const perfil = perfis.find(p => p.id === u.perfil_acesso_id);
      texto += `\n${u.full_name} (${u.email})\n`;
      texto += `  GroupId: ${u.group_id || u.grupo_id || u.grupo_atual_id || grupoId || "-"}\n`;
      texto += `  EmpresaId: ${u.empresa_id || u.empresa_atual_id || "-"}\n`;
      texto += `  Perfil: ${perfil?.nome_perfil || 'Sem perfil'}\n`;
      texto += `  Role: ${u.role}\n`;
      texto += `  Empresas: ${u.empresas_vinculadas?.length || 0}\n`;
    });

    const blob = new Blob([texto], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio-permissoes-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    void auditarRelatorio({ formato: "TXT", resumo: {
      total_perfis: perfis.length,
      total_usuarios: usuarios.length,
      total_empresas: empresas.length,
      empresas_grupo_total: empresasGrupoIds.length,
    } });
    
    toast.success("Relatório TXT exportado!");
  };

  return (
    <Card className="w-full h-full">
      <CardHeader className="bg-slate-50 border-b">
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="w-4 h-4 text-blue-600" />
          Exportar Relatório de Permissões
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
          <div className="p-4 border rounded-lg">
            <Shield className="w-8 h-8 text-blue-600 mx-auto mb-2" />
            <p className="text-2xl font-bold text-slate-900">{perfis.length}</p>
            <p className="text-xs text-slate-500">Perfis</p>
          </div>
          <div className="p-4 border rounded-lg">
            <Users className="w-8 h-8 text-green-600 mx-auto mb-2" />
            <p className="text-2xl font-bold text-slate-900">{usuarios.length}</p>
            <p className="text-xs text-slate-500">Usuários</p>
          </div>
          <div className="p-4 border rounded-lg">
            <Building2 className="w-8 h-8 text-purple-600 mx-auto mb-2" />
            <p className="text-2xl font-bold text-slate-900">{empresas.length}</p>
            <p className="text-xs text-slate-500">Empresas</p>
          </div>
        </div>

        {!contextoValido && (
          <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
            {mensagemContextoObrigatorio}
          </div>
        )}

        <div className="space-y-2">
          <Button
            onClick={gerarRelatorio}
            className="w-full justify-start"
            variant="outline"
            disabled={!contextoValido || !podeExportar}
            data-action="RBAC.Relatorio.exportarJson"
            data-permission="Sistema.Controle de Acesso.exportar"
            data-context-required="group-or-company"
            data-sensitive="true"
          >
            <Download className="w-4 h-4 mr-2" />
            Exportar Relatório Completo (JSON)
          </Button>
          
          <Button
            onClick={gerarRelatorioSimplificado}
            className="w-full justify-start"
            variant="outline"
            disabled={!contextoValido || !podeExportar}
            data-action="RBAC.Relatorio.exportarTxt"
            data-permission="Sistema.Controle de Acesso.exportar"
            data-context-required="group-or-company"
            data-sensitive="true"
          >
            <FileText className="w-4 h-4 mr-2" />
            Exportar Relatório Simplificado (TXT)
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
