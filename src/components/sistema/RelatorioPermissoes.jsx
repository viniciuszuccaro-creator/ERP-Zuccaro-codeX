import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, FileText, Eye, Shield, Users, Building2 } from "lucide-react";
import { toast } from "sonner";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";

export default function RelatorioPermissoes({ perfis = [], usuarios = [], empresas = [] }) {
  const { empresaAtual, grupoAtual, contexto, createInContext } = useContextoVisual();
  const { user, isAdmin, hasPermission } = usePermissions();
  const grupoId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const empresaId = contexto === "grupo" ? null : empresaAtual?.id || null;
  const contextoValido = !!(grupoId || empresaId);
  const podeExportar = isAdmin() || hasPermission("Sistema", "Controle de Acesso", "exportar");

  const auditarExportacao = async (formato, resumo) => {
    try {
      await createInContext('AuditLog', {
        usuario: user?.full_name || user?.email || "Sistema",
        usuario_id: user?.id || null,
        group_id: grupoId,
        empresa_id: empresaId,
        acao: "Exportacao",
        modulo: "Controle de Acesso",
        entidade: "RelatorioPermissoes",
        descricao: `Exportacao de relatorio de permissoes em ${formato}`,
        dados_novos: resumo,
        sucesso: true,
        data_hora: new Date().toISOString(),
      });
    } catch (error) {
      console.warn("[RBAC] Falha ao auditar exportacao:", error);
    }
  };
  const gerarRelatorio = () => {
    if (!contextoValido) {
      toast.error("Selecione um grupo ou empresa antes de exportar.");
      return;
    }
    if (!podeExportar) {
      toast.error("Sem permissao para exportar relatorio de permissoes.");
      return;
    }

    const relatorio = {
      data_geracao: new Date().toISOString(),
      resumo: {
        total_perfis: perfis.length,
        total_usuarios: usuarios.length,
        total_empresas: empresas.length,
        usuarios_sem_perfil: usuarios.filter(u => !u.perfil_acesso_id).length
      },
      perfis: perfis.map(p => ({
        nome: p.nome_perfil,
        nivel: p.nivel_perfil,
        usuarios_vinculados: usuarios.filter(u => u.perfil_acesso_id === p.id).length,
        conflitos_sod: p.conflitos_sod_detectados?.length || 0,
        ativo: p.ativo
      })),
      usuarios: usuarios.map(u => ({
        nome: u.full_name,
        email: u.email,
        perfil: perfis.find(p => p.id === u.perfil_acesso_id)?.nome_perfil || "Sem perfil",
        empresas: u.empresas_vinculadas?.length || 0,
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
    auditarExportacao("JSON", relatorio.resumo);
    
    toast.success("Relatório exportado!");
  };

  const gerarRelatorioSimplificado = () => {
    if (!contextoValido) {
      toast.error("Selecione um grupo ou empresa antes de exportar.");
      return;
    }
    if (!podeExportar) {
      toast.error("Sem permissao para exportar relatorio de permissoes.");
      return;
    }

    let texto = `RELATÓRIO DE PERMISSÕES E ACESSOS\n`;
    texto += `Gerado em: ${new Date().toLocaleString('pt-BR')}\n\n`;
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
    auditarExportacao("TXT", {
      total_perfis: perfis.length,
      total_usuarios: usuarios.length,
      total_empresas: empresas.length,
    });
    
    toast.success("Relatório TXT exportado!");
  };

  return (
    <Card>
      <CardHeader className="bg-slate-50 border-b">
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="w-4 h-4 text-blue-600" />
          Exportar Relatório de Permissões
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        <div className="grid grid-cols-3 gap-4 text-center">
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

        <div className="space-y-2">
          <Button
            onClick={gerarRelatorio}
            className="w-full justify-start"
            variant="outline"
            disabled={!contextoValido || !podeExportar}
            data-action="RBAC.Relatorio.exportarJson"
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
          >
            <FileText className="w-4 h-4 mr-2" />
            Exportar Relatório Simplificado (TXT)
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
