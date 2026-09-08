import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Building2, Users, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import useContextoGrupoEmpresa from "@/components/lib/useContextoGrupoEmpresa";

/**
 * Componente seletor de contexto: GRUPO ou EMPRESA
 * Aparece no header/topo do sistema
 * Permite trocar entre visão consolidada (grupo) e visão individual (empresa)
 */
export default function EmpresaSwitcher() {
  const {
    user,
    contexto,
    grupoAtual,
    empresaAtual,
    empresasDoGrupo,
    podeOperarEmGrupo,
    trocarParaGrupo,
    trocarParaEmpresa,
    isLoading
  } = useContextoGrupoEmpresa();

  const [open, setOpen] = useState(false);
  const [termo, setTermo] = useState("");

  // Buscar grupos disponíveis para o usuário (somente vínculos; sem listagem global)
  const { data: gruposDisponiveis = [] } = useQuery({
    queryKey: ['grupos-usuario', user?.id],
    queryFn: async () => {
      if (!user?.grupos_vinculados || user.grupos_vinculados.length === 0) {
        return [];
      }

      const grupos = [];
      for (const vinculo of user.grupos_vinculados) {
        if (vinculo.ativo !== false && vinculo.grupo_id) {
          try {
            const grupo = await base44.entities.GrupoEmpresarial.get(vinculo.grupo_id);
            if (grupo && (!grupo.status || grupo.status === 'Ativo')) {
              grupos.push(grupo);
            }
          } catch (error) {
            console.warn(`Grupo ${vinculo.grupo_id} nao encontrado:`, error);
          }
        }
      }
      return grupos;
    },
    enabled: !!user,
  });

  // Empresas disponíveis: somente empresas_vinculadas do usuario (sem Empresa.list global)
  const { data: empresasDisponiveis = [] } = useQuery({
    queryKey: ['empresas-usuario', user?.id],
    queryFn: async () => {
      if (user?.empresas_vinculadas && user.empresas_vinculadas.length > 0) {
        const empresas = [];
        for (const rawVinculo of user.empresas_vinculadas) {
          const vinculo = typeof rawVinculo === 'string'
            ? { empresa_id: rawVinculo, ativo: true }
            : rawVinculo;
          if (vinculo?.ativo !== false && vinculo?.empresa_id) {
            try {
              const empresa = await base44.entities.Empresa.get(vinculo.empresa_id);
              if (empresa && empresa.status === 'Ativa') {
                empresas.push({
                  ...empresa,
                  nivel_acesso: vinculo.nivel_acesso || 'Operacional'
                });
              }
            } catch (error) {
              console.warn(`Empresa ${vinculo.empresa_id} não encontrada:`, error);
            }
          }
        }
        return empresas;
      }

      return [];
    },
    enabled: !!user,
  });

   // Filtro e ordenação local de empresas (UX)
   const empresasListadas = (empresasDisponiveis || [])
     .filter((e) => {
       if (!termo) return true;
       const t = termo.toLowerCase();
       return (
         (e.nome_fantasia || e.razao_social || "").toLowerCase().includes(t) ||
         (e.cnpj || "").toLowerCase().includes(t)
       );
     })
     .sort((a, b) => (a.nome_fantasia || a.razao_social || "").localeCompare(b.nome_fantasia || b.razao_social || ""));

   if (isLoading || !user) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-slate-100 rounded-lg animate-pulse">
        <div className="w-32 h-8 bg-slate-200 rounded"></div>
      </div>
    );
  }

  const handleSelecaoContexto = (value) => {
    const [tipo, id] = value.split(':');
    
    if (tipo === 'grupo') {
      trocarParaGrupo.mutate(id);
    } else if (tipo === 'empresa') {
      trocarParaEmpresa.mutate(id);
    }
    
    setOpen(false);
  };

  const valorAtual = contexto === 'grupo' 
    ? `grupo:${grupoAtual?.id}` 
    : `empresa:${empresaAtual?.id}`;

  const nomeAtual = contexto === 'grupo'
    ? grupoAtual?.nome_do_grupo
    : (empresaAtual?.nome_fantasia || empresaAtual?.razao_social);

  return (
    <div className="relative">
      <Select value={valorAtual} onValueChange={handleSelecaoContexto} open={open} onOpenChange={setOpen}>
        <SelectTrigger className="w-64 md:w-72 lg:w-[280px] bg-white border-slate-300 hover:bg-slate-50 transition-colors">
          <div className="flex items-center gap-2 w-full">
            {contexto === 'grupo' ? (
              <Users className="w-4 h-4 text-blue-600" />
            ) : (
              <Building2 className="w-4 h-4 text-purple-600" />
            )}
            <div className="flex flex-col items-start flex-1 min-w-0">
              <span className="text-xs text-slate-500 uppercase font-semibold">
                {contexto === 'grupo' ? 'Grupo Corporativo' : 'Empresa'}
              </span>
              <span className="text-sm font-medium text-slate-900 truncate w-full">
                {nomeAtual}
              </span>
            </div>
            <ChevronDown className="w-4 h-4 text-slate-400" />
          </div>
        </SelectTrigger>
        
        <SelectContent className="w-64 md:w-72 lg:w-[280px]">
           <div className="p-2 sticky top-0 bg-white border-b border-slate-200">
             <Input
               value={termo}
               onChange={(e) => setTermo(e.target.value)}
               placeholder="Buscar empresa por nome ou CNPJ..."
               className="h-8 text-sm"
             />
           </div>
          {/* GRUPOS DISPONÍVEIS */}
          {podeOperarEmGrupo && gruposDisponiveis.length > 0 && (
            <SelectGroup>
              <SelectLabel className="flex items-center gap-2 text-xs font-semibold text-slate-600 uppercase">
                <Users className="w-4 h-4" />
                Grupos Corporativos
              </SelectLabel>
              {gruposDisponiveis.map((grupo) => (
                <SelectItem 
                  key={`grupo:${grupo.id}`} 
                  value={`grupo:${grupo.id}`}
                  className="cursor-pointer"
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-blue-600" />
                      <span className="font-medium">{grupo.nome_do_grupo}</span>
                    </div>
                    {contexto === 'grupo' && grupoAtual?.id === grupo.id && (
                      <Badge className="bg-blue-100 text-blue-700 text-xs">Atual</Badge>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectGroup>
          )}

          {/* EMPRESAS DISPONÍVEIS */}
          {empresasListadas.length > 0 && (
            <SelectGroup>
              <SelectLabel className="flex items-center gap-2 text-xs font-semibold text-slate-600 uppercase mt-2">
                <Building2 className="w-4 h-4" />
                Empresas / Filiais
              </SelectLabel>
              {empresasListadas.map((empresa) => (
                <SelectItem 
                  key={`empresa:${empresa.id}`} 
                  value={`empresa:${empresa.id}`}
                  className="cursor-pointer"
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-purple-600" />
                        <span className="font-medium">
                          {empresa.nome_fantasia || empresa.razao_social}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 ml-6">
                        <span className="text-xs text-slate-500">{empresa.cnpj}</span>
                        <Badge variant="outline" className="text-xs">
                          {empresa.tipo}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {empresa.nivel_acesso}
                        </Badge>
                      </div>
                    </div>
                    {contexto === 'empresa' && empresaAtual?.id === empresa.id && (
                      <Badge className="bg-purple-100 text-purple-700 text-xs">Atual</Badge>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectGroup>
          )}

          {/* MENSAGEM SE NÃO TIVER ACESSO */}
          {!podeOperarEmGrupo && gruposDisponiveis.length === 0 && empresasDisponiveis.length === 0 && (
            <div className="p-4 text-center text-sm text-slate-500">
              <p>Você não tem acesso a grupos ou empresas.</p>
              <p className="text-xs mt-1">Entre em contato com o administrador.</p>
            </div>
          )}
        </SelectContent>
      </Select>

      {/* INDICADOR DE CONTEXTO ATUAL */}
      <div className="absolute -bottom-6 left-0 right-0 flex justify-center">
        <Badge 
          className={`text-[10px] ${
            contexto === 'grupo' 
              ? 'bg-blue-100 text-blue-700 border-blue-300' 
              : 'bg-purple-100 text-purple-700 border-purple-300'
          }`}
        >
          {contexto === 'grupo' ? 'Visão Consolidada' : 'Visão Individual'}
        </Badge>
      </div>
    </div>
  );
}
