import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Sparkles } from "lucide-react";
import { BotaoBuscaAutomatica } from "@/components/lib/BuscaDadosPublicos";
import usePermissions from "@/components/lib/usePermissions";
import { useContextoVisual } from "@/components/lib/useContextoVisual";

const sanitizeText = (value, max = 500) => String(value ?? "").replace(/[<>]/g, "").slice(0, max).trim();
const sanitizeCode = (value, max = 20) => String(value ?? "").replace(/[^0-9A-Za-z_.\-/\s]/g, "").slice(0, max).trim();
const toNumber = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

export default function FiscalContabilSection({ formData, setFormData, sugestoesIA, handleDadosNCM, planoContas }) {
  const { hasPermission } = usePermissions();
  const { empresaAtual, grupoAtual } = useContextoVisual();
  const contextoValido = Boolean(empresaAtual?.id || grupoAtual?.id || formData?.empresa_id || formData?.group_id || formData?.grupo_id);
  const podeEditar = hasPermission?.("Cadastros.Produto.editar") || hasPermission?.("Fiscal.Produto.editar");
  const podeBuscarFiscal = hasPermission?.("Cadastros.Produto.ia") || hasPermission?.("Fiscal.Produto.buscarDados") || podeEditar;
  const canEdit = contextoValido && podeEditar;

  return (
    <>
      <Card className="border-purple-200 bg-purple-50">
        <CardHeader className="bg-purple-100 border-b border-purple-200 pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="w-5 h-5 text-purple-600" />
            ConfiguraÃ§Ã£o Fiscal
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Origem da Mercadoria</Label>
              <Select value={formData.origem_mercadoria} onValueChange={(v) => setFormData(prev => ({...prev, origem_mercadoria: sanitizeText(v, 120)}))}>
                <SelectTrigger disabled={!canEdit} data-permission="Fiscal.Produto.editar" data-action="selecionar-origem-mercadoria-produto" data-sensitive><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0 - Nacional">0 - Nacional</SelectItem>
                  <SelectItem value="1 - Estrangeira ImportaÃ§Ã£o Direta">1 - Estrangeira ImportaÃ§Ã£o Direta</SelectItem>
                  <SelectItem value="2 - Estrangeira Mercado Interno">2 - Estrangeira Mercado Interno</SelectItem>
                  <SelectItem value= "3 - Nacional com ConteÃºdo Importado >40%">3 - Nacional com ConteÃºdo Importado {'>'}40%</SelectItem>
                  <SelectItem value="4 - Nacional por Proc. Prod. BÃ¡sico">4 - Nacional por Proc. Prod. BÃ¡sico</SelectItem>
                  <SelectItem value= "5 - Nacional com ConteÃºdo Importado <=40%">5 - Nacional com ConteÃºdo Importado {'<'}=40%</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Regime TributÃ¡rio do Produto</Label>
              <Select value={formData.regime_tributario_produto} onValueChange={(v) => setFormData(prev => ({...prev, regime_tributario_produto: sanitizeText(v, 80)}))}>
                <SelectTrigger disabled={!canEdit} data-permission="Fiscal.Produto.editar" data-action="selecionar-regime-tributario-produto" data-sensitive><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Simples Nacional">Simples Nacional</SelectItem>
                  <SelectItem value="Lucro Presumido">Lucro Presumido</SelectItem>
                  <SelectItem value="Lucro Real">Lucro Real</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 items-end">
            <div>
              <Label>NCM (CÃ³digo Fiscal)</Label>
              <Input
                value={formData.ncm || ""}
                onChange={(e) => setFormData(prev => ({ ...prev, ncm: sanitizeCode(e.target.value, 8) }))}
                placeholder="00000000"
                maxLength={8}
                disabled={!canEdit}
                data-permission="Fiscal.Produto.editar"
                data-action="editar-ncm-produto"
                data-sensitive
              />
              {sugestoesIA?.ncm_info && (
                <p className="text-xs text-blue-600 mt-1">â„¹ï¸ {sugestoesIA.ncm_info}</p>
              )}
            </div>
            <div>
              <BotaoBuscaAutomatica
                tipo="ncm"
                valor={formData.ncm}
                onDadosEncontrados={handleDadosNCM}
                disabled={!formData.ncm || formData.ncm.length !== 8 || !contextoValido || !podeBuscarFiscal}
                data-permission="Fiscal.Produto.buscarDados"
                data-action="buscar-dados-ncm-produto"
                data-sensitive
              >
                Buscar NCM
              </BotaoBuscaAutomatica>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>CEST</Label>
              <Input
                value={formData.cest || ""}
                onChange={(e) => setFormData(prev => ({ ...prev, cest: sanitizeCode(e.target.value, 10) }))}
                placeholder="00.000.00"
                disabled={!canEdit}
                data-permission="Fiscal.Produto.editar"
                data-action="editar-cest-produto"
                data-sensitive
              />
            </div>
            <div>
              <Label>CFOP PadrÃ£o Venda</Label>
              <Input
                value={formData.cfop_padrao_venda || ""}
                onChange={(e) => setFormData(prev => ({ ...prev, cfop_padrao_venda: sanitizeCode(e.target.value, 8) }))}
                placeholder="5102"
                disabled={!canEdit}
                data-permission="Fiscal.Produto.editar"
                data-action="editar-cfop-venda-produto"
                data-sensitive
              />
            </div>
            <div>
              <Label>CFOP PadrÃ£o Compra</Label>
              <Input
                value={formData.cfop_padrao_compra || ""}
                onChange={(e) => setFormData(prev => ({ ...prev, cfop_padrao_compra: sanitizeCode(e.target.value, 8) }))}
                placeholder="1102"
                disabled={!canEdit}
                data-permission="Fiscal.Produto.editar"
                data-action="editar-cfop-compra-produto"
                data-sensitive
              />
            </div>
          </div>

          <Alert className="border-purple-300 bg-purple-100 mt-4">
            <Sparkles className="w-4 h-4 text-purple-700" />
            <AlertDescription className="text-sm text-purple-900">
              Defina corretamente NCM/CFOP e alÃ­quotas para evitar rejeiÃ§Ãµes na NF-e.
            </AlertDescription>
          </Alert>

          <h4 className="font-bold text-slate-800 mt-6 mb-3 pt-4 border-t">Detalhes da TributaÃ§Ã£o</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <Label>ICMS CST</Label>
              <Input
                value={formData.tributacao?.icms_cst || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, tributacao: { ...prev.tributacao, icms_cst: sanitizeCode(e.target.value, 8) } }))}
                placeholder="00"
                disabled={!canEdit}
                data-permission="Fiscal.Produto.editar"
                data-action="editar-icms-cst-produto"
                data-sensitive
              />
            </div>
            <div>
              <Label>ICMS AlÃ­quota (%)</Label>
              <Input
                type="number" step="0.01"
                value={formData.tributacao?.icms_aliquota || 0}
                onChange={(e) => setFormData(prev => ({ ...prev, tributacao: { ...prev.tributacao, icms_aliquota: toNumber(e.target.value, 0) } }))}
                disabled={!canEdit}
                data-permission="Fiscal.Produto.editar"
                data-action="editar-icms-aliquota-produto"
                data-sensitive
              />
            </div>
            <div>
              <Label>PIS CST</Label>
              <Input
                value={formData.tributacao?.pis_cst || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, tributacao: { ...prev.tributacao, pis_cst: sanitizeCode(e.target.value, 8) } }))}
                placeholder="01"
                disabled={!canEdit}
                data-permission="Fiscal.Produto.editar"
                data-action="editar-pis-cst-produto"
                data-sensitive
              />
            </div>
            <div>
              <Label>PIS AlÃ­quota (%)</Label>
              <Input type="number" step="0.01" value={formData.tributacao?.pis_aliquota || 0} onChange={(e) => setFormData(prev => ({ ...prev, tributacao: { ...prev.tributacao, pis_aliquota: toNumber(e.target.value, 0) } }))} disabled={!canEdit} data-permission="Fiscal.Produto.editar" data-action="editar-pis-aliquota-produto" data-sensitive />
            </div>
            <div>
              <Label>COFINS CST</Label>
              <Input value={formData.tributacao?.cofins_cst || ''} onChange={(e) => setFormData(prev => ({ ...prev, tributacao: { ...prev.tributacao, cofins_cst: sanitizeCode(e.target.value, 8) } }))} placeholder="01" disabled={!canEdit} data-permission="Fiscal.Produto.editar" data-action="editar-cofins-cst-produto" data-sensitive />
            </div>
            <div>
              <Label>COFINS AlÃ­quota (%)</Label>
              <Input type="number" step="0.01" value={formData.tributacao?.cofins_aliquota || 0} onChange={(e) => setFormData(prev => ({ ...prev, tributacao: { ...prev.tributacao, cofins_aliquota: toNumber(e.target.value, 0) } }))} disabled={!canEdit} data-permission="Fiscal.Produto.editar" data-action="editar-cofins-aliquota-produto" data-sensitive />
            </div>
            <div>
              <Label>IPI CST</Label>
              <Input value={formData.tributacao?.ipi_cst || ''} onChange={(e) => setFormData(prev => ({ ...prev, tributacao: { ...prev.tributacao, ipi_cst: sanitizeCode(e.target.value, 8) } }))} placeholder="50" disabled={!canEdit} data-permission="Fiscal.Produto.editar" data-action="editar-ipi-cst-produto" data-sensitive />
            </div>
            <div>
              <Label>IPI AlÃ­quota (%)</Label>
              <Input type="number" step="0.01" value={formData.tributacao?.ipi_aliquota || 0} onChange={(e) => setFormData(prev => ({ ...prev, tributacao: { ...prev.tributacao, ipi_aliquota: toNumber(e.target.value, 0) } }))} disabled={!canEdit} data-permission="Fiscal.Produto.editar" data-action="editar-ipi-aliquota-produto" data-sensitive />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200">
        <CardHeader className="bg-slate-50 border-b pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="w-5 h-5 text-slate-600" />
            ContabilizaÃ§Ã£o
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div>
            <Label>Conta ContÃ¡bil</Label>
            <Select value={formData.conta_contabil_id || ''} onValueChange={(v) => setFormData(prev => ({ ...prev, conta_contabil_id: sanitizeCode(v, 120) }))}>
              <SelectTrigger disabled={!canEdit} data-permission="Fiscal.Produto.editar" data-action="selecionar-conta-contabil-produto" data-sensitive>
                <SelectValue placeholder="Selecione a conta contÃ¡bil..." />
              </SelectTrigger>
              <SelectContent>
                {planoContas.filter(c => c.tipo === 'Receita' || c.tipo === 'Despesa').map(conta => (
                  <SelectItem key={conta.id} value={conta.id}>
                    {conta.codigo} - {conta.descricao}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
