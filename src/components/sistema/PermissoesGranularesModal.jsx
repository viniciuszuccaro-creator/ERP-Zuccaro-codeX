import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle, XCircle, Settings, Building2, Sliders } from "lucide-react";
import { toast } from "sonner";

const PERMISSOES_GRANULARES = {
  comercial: {
    pedidos: {
      pode_ver_apenas_proprios: "Visualizar apenas próprios pedidos",
      pode_editar_apos_aprovacao: "Editar pedido após aprovação",
      limite_desconto_percentual: "Limite de desconto (%)",
      limite_aprovacao_valor: "Limite de aprovação (R$)",
      pode_cancelar_pedido: "Cancelar pedidos",
      pode_alterar_tabela_preco: "Alterar tabela de preço no pedido"
    },
    clientes: {
      pode_ver_dados_financeiros: "Visualizar dados financeiros",
      pode_alterar_limite_credito: "Alterar limite de crédito",
      pode_bloquear_cliente: "Bloquear/desbloquear cliente"
    }
  },
  financeiro: {
    contas_receber: {
      pode_baixar_titulos: "Baixar títulos",
      pode_estornar_baixas: "Estornar baixas",
      pode_gerar_boletos: "Gerar boletos",
      pode_enviar_cobrancas: "Enviar cobranças",
      limite_desconto_negociacao: "Limite desconto (%)"
    },
    contas_pagar: {
      pode_baixar_titulos: "Baixar títulos",
      pode_estornar_baixas: "Estornar baixas",
      limite_aprovacao_pagamento: "Limite aprovação (R$)",
      pode_aprovar_pagamentos: "Aprovar pagamentos"
    },
    caixa: {
      pode_abrir_caixa: "Abrir caixa",
      pode_fechar_caixa: "Fechar caixa",
      pode_fazer_sangria: "Fazer sangria",
      pode_fazer_suprimento: "Fazer suprimento"
    }
  },
  estoque: {
    movimentacoes: {
      pode_ajustar_estoque: "Ajustar estoque",
      requer_aprovacao_ajuste: "Ajuste requer aprovação",
      pode_transferir_empresas: "Transferir entre empresas",
      pode_ver_custo_produtos: "Visualizar custo de produtos"
    }
  },
  producao: {
    ordens_producao: {
      visualizar: "Visualizar OPs",
      editar: "Editar OPs",
      reprogramar: "Reprogramar datas",
      apontar: "Fazer apontamentos",
      pode_alterar_quantidade: "Alterar quantidade produzida",
      pode_registrar_refugo: "Registrar refugo"
    }
  },
  chatbot: {
    atendimento: {
      pode_atender_transbordo: "Atender transbordo",
      ver_todas_conversas: "Ver todas conversas",
      pode_finalizar_conversa: "Finalizar conversa",
      pode_transferir_conversa: "Transferir conversa",
      pode_criar_pedido_chat: "Criar pedido no chat",
      pode_gerar_boleto_chat: "Gerar boleto no chat"
    }
  }
};

export default function PermissoesGranularesModal({ open, onOpenChange, perfil, onSave, disabled = false }) {
  const [permissoesGranulares, setPermissoesGranulares] = useState({});

  useEffect(() => {
    if (perfil) {
      setPermissoesGranulares(perfil.permissoes || {});
    }
  }, [perfil]);

  const togglePermissao = (modulo, funcionalidade, permissao) => {
    if (disabled) {
      toast.error("Selecione um grupo ou empresa antes de alterar permissoes.");
      return;
    }
    setPermissoesGranulares(prev => {
      const novo = { ...prev };
      if (!novo[modulo]) novo[modulo] = {};
      if (!novo[modulo][funcionalidade]) novo[modulo][funcionalidade] = {};
      
      novo[modulo][funcionalidade][permissao] = !novo[modulo][funcionalidade][permissao];
      return novo;
    });
  };

  const handleSalvar = () => {
    if (disabled) {
      toast.error("Selecione um grupo ou empresa antes de salvar permissoes.");
      return;
    }
    if (onSave) {
      onSave({ ...perfil, permissoes: permissoesGranulares });
      toast.success("Permissões granulares atualizadas!");
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col w-full">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-purple-600" />
            Permissões Granulares - {perfil?.nome_perfil}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="comercial" className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid grid-cols-3 md:grid-cols-6 gap-1">
            {Object.keys(PERMISSOES_GRANULARES).map(mod => (
              <TabsTrigger key={mod} value={mod} className="text-xs" data-action={`RBAC.PermissoesGranulares.tab.${mod}`} data-permission="Sistema.Controle de Acesso.visualizar">
                {mod.charAt(0).toUpperCase() + mod.slice(1)}
              </TabsTrigger>
            ))}
          </TabsList>

          <ScrollArea className="flex-1 mt-4">
            {Object.entries(PERMISSOES_GRANULARES).map(([modulo, funcionalidades]) => (
              <TabsContent key={modulo} value={modulo} className="space-y-4 mt-0">
                {Object.entries(funcionalidades).map(([funcId, permissoes]) => (
                  <Card key={funcId}>
                    <CardContent className="p-4">
                      <h4 className="font-semibold mb-3 capitalize">{funcId.replace(/_/g, ' ')}</h4>
                      <div className="space-y-3">
                        {Object.entries(permissoes).map(([permId, label]) => (
                          <div key={permId} className="flex items-center justify-between">
                            <span className="text-sm">{label}</span>
                            <Switch
                              data-action={`RBAC.PermissoesGranulares.${modulo}.${funcId}.${permId}`}
                              data-permission="Sistema.Controle de Acesso.editar"
                              data-sensitive="true"
                              checked={permissoesGranulares?.[modulo]?.[funcId]?.[permId] || false}
                              onCheckedChange={() => togglePermissao(modulo, funcId, permId)}
                              disabled={disabled}
                            />
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>
            ))}
          </ScrollArea>
        </Tabs>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} data-action="RBAC.PermissoesGranulares.cancelar">
            Cancelar
          </Button>
          <Button onClick={handleSalvar} disabled={disabled} className="bg-blue-600 hover:bg-blue-700" data-action="RBAC.PermissoesGranulares.salvar" data-permission="Sistema.Controle de Acesso.editar" data-sensitive="true">
            <CheckCircle className="w-4 h-4 mr-2" />
            Salvar Permissões
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
