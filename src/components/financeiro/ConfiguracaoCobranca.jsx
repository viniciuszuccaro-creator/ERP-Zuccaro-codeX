import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/use-toast";
import { CreditCard, DollarSign, Building2, CheckCircle, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useContextoVisual } from "@/components/lib/useContextoVisual";

/**
 * Configuração de Cobrança (Boletos/PIX) por Empresa
 */
export default function ConfiguracaoCobranca({ empresas: empresasProp, windowMode = false }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { empresaAtual, grupoAtual, filterInContext, createInContext, updateInContext } = useContextoVisual();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || null;
  const contextoValido = Boolean(empresaAtual?.id || groupId);

  const [empresaSelecionada, setEmpresaSelecionada] = React.useState(null);
  const [config, setConfig] = React.useState({
    ativo: false,
    provedor_cobranca: "Nenhum",
    api_url: "",
    api_key: "",
    api_token: "",
    client_id: "",
    client_secret: "",
    conta_id: "",
    habilitar_boleto: true,
    habilitar_pix: true,
    habilitar_cartao: false,
    dias_vencimento_padrao: 3,
    multa_pos_vencimento_percent: 2,
    juros_ao_dia_percent: 0.033,
    desconto_antecipacao_percent: 0,
    mensagem_padrao_boleto: "Não receber após o vencimento. Sujeito a multa e juros.",
    mensagem_padrao_pix: "PIX válido por 24h",
    pix_chave: "",
    pix_tipo: "CNPJ",
    enviar_email_automatico: true,
    enviar_whatsapp_automatico: false,
    modo_simulacao: true,
    webhook_url: "",
    webhook_token: ""
  });

  // Escopo multiempresa: sem list/create/update unscoped; erro ≠ zero.
  const { data: empresasContext = [], isError: isErrorEmpresas } = useQuery({
    queryKey: ['empresas-config-cobranca', groupId, empresaAtual?.id],
    queryFn: () => filterInContext('Empresa', {}, 'nome_fantasia', 500),
    enabled: contextoValido && !(Array.isArray(empresasProp) && empresasProp.length > 0),
  });
  const empresas = (Array.isArray(empresasProp) && empresasProp.length > 0) ? empresasProp : empresasContext;

  const { data: configsExistentes = [], isError: isErrorConfigs } = useQuery({
    queryKey: ['configs-cobranca', groupId, empresaAtual?.id],
    queryFn: () => filterInContext('ConfiguracaoCobrancaEmpresa', {}, '-created_date', 500),
    enabled: contextoValido,
  });

  const salvarMutation = useMutation({
    mutationFn: async () => {
      if (!contextoValido) throw new Error('Selecione um grupo ou empresa antes de salvar cobrança.');
      if (!empresaSelecionada?.id) throw new Error('Selecione a empresa da configuração de cobrança.');
      const dadosConfig = {
        group_id: empresaSelecionada.grupo_id || empresaSelecionada.group_id || groupId,
        empresa_id: empresaSelecionada.id,
        empresa_nome: empresaSelecionada.nome_fantasia || empresaSelecionada.razao_social,
        ...config,
        status_conexao: config.ativo ? "configurado" : "nao_configurado"
      };

      const existente = configsExistentes.find(c => c.empresa_id === empresaSelecionada.id);

      if (existente) {
        return await updateInContext('ConfiguracaoCobrancaEmpresa', existente.id, dadosConfig);
      }
      return await createInContext('ConfiguracaoCobrancaEmpresa', dadosConfig);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['configs-cobranca'] });
      toast({ title: "✅ Configuração de cobrança salva!" });
    },
    onError: (err) => {
      toast({
        title: "Não foi possível salvar",
        description: err?.message || "Erro de contexto ou persistência.",
        variant: "destructive",
      });
    },
  });

  const carregarConfig = (empresa) => {
    setEmpresaSelecionada(empresa);
    const existente = configsExistentes.find(c => c.empresa_id === empresa.id);
    if (existente) {
      setConfig(existente);
    } else {
      setConfig({
        ...config,
        pix_chave: empresa.cnpj,
        pix_tipo: "CNPJ"
      });
    }
  };

  return (
    <div className={windowMode ? "w-full h-full flex flex-col overflow-auto" : "space-y-6"}>
      <div className={windowMode ? "p-6 space-y-6 flex-1" : "space-y-6"}>
      {/* Seleção de Empresa */}
      <Card className="border-0 shadow-md">
        <CardHeader className="bg-blue-50 border-b">
          <CardTitle className="text-base">Selecione a Empresa</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          {!contextoValido && (
            <p className="text-xs text-slate-500 mb-3">
              Selecione um grupo ou empresa para carregar configurações de cobrança.
            </p>
          )}
          {(isErrorEmpresas || isErrorConfigs) && (
            <p className="text-xs text-slate-500 mb-3">
              Contagem de cobrança indisponível (erro de carga ≠ zero).
            </p>
          )}
          <div className="grid gap-3">
            {empresas.map(empresa => {
              const config = configsExistentes.find(c => c.empresa_id === empresa.id);
              const estaConfigurada = config && config.ativo;

              return (
                <Card
                  key={empresa.id}
                  className={`cursor-pointer transition-all ${
                    empresaSelecionada?.id === empresa.id 
                      ? 'border-2 border-blue-500 bg-blue-50' 
                      : estaConfigurada
                        ? 'border-2 border-green-300 hover:border-green-500'
                        : 'border hover:border-slate-300'
                  }`}
                  onClick={() => carregarConfig(empresa)}
                >
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3">
                        <Building2 className="w-5 h-5 text-purple-600" />
                        <div>
                          <p className="font-semibold">{empresa.nome_fantasia || empresa.razao_social}</p>
                          <p className="text-xs text-slate-600">CNPJ: {empresa.cnpj}</p>
                        </div>
                      </div>
                      {estaConfigurada && (
                        <Badge className="bg-green-600">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Configurado
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Formulário de Configuração */}
      {empresaSelecionada && (
        <form onSubmit={(e) => { e.preventDefault(); salvarMutation.mutate(); }} className="space-y-6">
          {/* Provedor */}
          <Card className="border-0 shadow-md">
            <CardHeader className="bg-purple-50 border-b">
              <CardTitle className="text-base">Provedor de Cobrança</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-3 mb-4">
                <Checkbox
                  checked={config.ativo}
                  onCheckedChange={(v) => setConfig({ ...config, ativo: v })}
                />
                <Label className="text-base font-semibold">Ativar cobrança para esta empresa</Label>
              </div>

              <div>
                <Label>Provedor *</Label>
                <Select
                  value={config.provedor_cobranca}
                  onValueChange={(v) => setConfig({ ...config, provedor_cobranca: v })}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Nenhum">Nenhum</SelectItem>
                    <SelectItem value="Asaas">Asaas</SelectItem>
                    <SelectItem value="Juno">Juno</SelectItem>
                    <SelectItem value="Pagar.me">Pagar.me</SelectItem>
                    <SelectItem value="Mercado Pago">Mercado Pago</SelectItem>
                    <SelectItem value="Banco do Brasil">Banco do Brasil</SelectItem>
                    <SelectItem value="Sicoob">Sicoob</SelectItem>
                    <SelectItem value="Outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {config.provedor_cobranca !== "Nenhum" && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>URL da API</Label>
                      <Input
                        value={config.api_url}
                        onChange={(e) => setConfig({ ...config, api_url: e.target.value })}
                        placeholder="https://api.asaas.com/v3"
                        className="mt-2"
                      />
                    </div>
                    <div>
                      <Label>API Key</Label>
                      <Input
                        type="password"
                        value={config.api_key}
                        onChange={(e) => setConfig({ ...config, api_key: e.target.value })}
                        placeholder="Sua chave de API"
                        className="mt-2"
                      />
                    </div>
                  </div>

                  <div>
                    <Label>ID da Conta no Provedor</Label>
                    <Input
                      value={config.conta_id}
                      onChange={(e) => setConfig({ ...config, conta_id: e.target.value })}
                      placeholder="acc_xxx..."
                      className="mt-2"
                    />
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Tipos Habilitados */}
          <Card className="border-0 shadow-md">
            <CardHeader className="bg-green-50 border-b">
              <CardTitle className="text-base">Formas de Cobrança</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-3">
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={config.habilitar_boleto}
                  onCheckedChange={(v) => setConfig({ ...config, habilitar_boleto: v })}
                />
                <Label className="text-base">Boleto Bancário</Label>
              </div>
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={config.habilitar_pix}
                  onCheckedChange={(v) => setConfig({ ...config, habilitar_pix: v })}
                />
                <Label className="text-base">PIX</Label>
              </div>
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={config.habilitar_cartao}
                  onCheckedChange={(v) => setConfig({ ...config, habilitar_cartao: v })}
                />
                <Label className="text-base">Cartão de Crédito</Label>
              </div>
            </CardContent>
          </Card>

          {/* Parâmetros Financeiros */}
          <Card className="border-0 shadow-md">
            <CardHeader className="bg-orange-50 border-b">
              <CardTitle className="text-base">Parâmetros Financeiros</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Dias até Vencimento</Label>
                  <Input
                    type="number"
                    value={config.dias_vencimento_padrao}
                    onChange={(e) => setConfig({ ...config, dias_vencimento_padrao: parseInt(e.target.value) })}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label>Multa após Vencimento (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={config.multa_pos_vencimento_percent}
                    onChange={(e) => setConfig({ ...config, multa_pos_vencimento_percent: parseFloat(e.target.value) })}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label>Juros ao Dia (%)</Label>
                  <Input
                    type="number"
                    step="0.001"
                    value={config.juros_ao_dia_percent}
                    onChange={(e) => setConfig({ ...config, juros_ao_dia_percent: parseFloat(e.target.value) })}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label>Desconto Antecipação (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={config.desconto_antecipacao_percent}
                    onChange={(e) => setConfig({ ...config, desconto_antecipacao_percent: parseFloat(e.target.value) })}
                    className="mt-2"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* PIX */}
          {config.habilitar_pix && (
            <Card className="border-0 shadow-md">
              <CardHeader className="bg-green-50 border-b">
                <CardTitle className="text-base">Configuração PIX</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Tipo de Chave</Label>
                    <Select
                      value={config.pix_tipo}
                      onValueChange={(v) => setConfig({ ...config, pix_tipo: v })}
                    >
                      <SelectTrigger className="mt-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CPF">CPF</SelectItem>
                        <SelectItem value="CNPJ">CNPJ</SelectItem>
                        <SelectItem value="Email">E-mail</SelectItem>
                        <SelectItem value="Telefone">Telefone</SelectItem>
                        <SelectItem value="Aleatoria">Aleatória</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Chave PIX</Label>
                    <Input
                      value={config.pix_chave}
                      onChange={(e) => setConfig({ ...config, pix_chave: e.target.value })}
                      placeholder="00.000.000/0001-00"
                      className="mt-2"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Mensagens */}
          <Card className="border-0 shadow-md">
            <CardHeader className="bg-slate-50 border-b">
              <CardTitle className="text-base">Mensagens Padrão</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div>
                <Label>Mensagem Boleto</Label>
                <Textarea
                  value={config.mensagem_padrao_boleto}
                  onChange={(e) => setConfig({ ...config, mensagem_padrao_boleto: e.target.value })}
                  rows={2}
                  className="mt-2"
                />
              </div>
              <div>
                <Label>Mensagem PIX</Label>
                <Textarea
                  value={config.mensagem_padrao_pix}
                  onChange={(e) => setConfig({ ...config, mensagem_padrao_pix: e.target.value })}
                  rows={2}
                  className="mt-2"
                />
              </div>
            </CardContent>
          </Card>

          {/* Envio Automático */}
          <Card className="border-0 shadow-md">
            <CardHeader className="bg-blue-50 border-b">
              <CardTitle className="text-base">Envio Automático</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-3">
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={config.enviar_email_automatico}
                  onCheckedChange={(v) => setConfig({ ...config, enviar_email_automatico: v })}
                />
                <Label>Enviar e-mail automaticamente ao gerar cobrança</Label>
              </div>
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={config.enviar_whatsapp_automatico}
                  onCheckedChange={(v) => setConfig({ ...config, enviar_whatsapp_automatico: v })}
                />
                <Label>Enviar WhatsApp automaticamente ao gerar cobrança</Label>
              </div>
            </CardContent>
          </Card>

          {/* Modo Simulação */}
          <Card className="border-2 border-yellow-300 bg-yellow-50">
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-6 h-6 text-yellow-600 flex-shrink-0" />
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <Checkbox
                      checked={config.modo_simulacao}
                      onCheckedChange={(v) => setConfig({ ...config, modo_simulacao: v })}
                    />
                    <Label className="font-semibold text-yellow-900">Modo Simulação</Label>
                  </div>
                  <p className="text-sm text-yellow-800">
                    Quando ativo, as cobranças serão geradas apenas localmente (mock), 
                    sem chamar a API do provedor. Use para testar o fluxo antes de ativar a integração real.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Botão Salvar */}
          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={salvarMutation.isPending || !contextoValido || !empresaSelecionada?.id}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {salvarMutation.isPending ? 'Salvando...' : 'Salvar Configuração'}
            </Button>
          </div>
        </form>
      )}

      {!empresaSelecionada && (
        <Card className="border-0 shadow-md">
          <CardContent className="p-12 text-center text-slate-500">
            <CreditCard className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p>Selecione uma empresa para configurar</p>
          </CardContent>
        </Card>
      )}
    </div></div>
  );
}