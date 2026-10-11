import React, { useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import useContextoVisual from "@/components/lib/useContextoVisual";
import useCadastroFormScopeGuard from "@/components/cadastros/hooks/useCadastroFormScopeGuard";
import { buildCrmQuoteOrderCommand, createCrmFormSubmissionGate, validateCrmQuoteOrderResult } from './crmFormSubmission';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShoppingCart, FileText, ArrowRight, CheckCircle } from "lucide-react";

/**
 * V21.1.2 - WINDOW MODE READY
 */
export default function ConverterOportunidade(props) {
  if(!props.windowMode && !props.open)return null;
  return <ConverterOportunidadeContent key={props.oportunidade?.id||'nova'} {...props} />;
}

function ConverterOportunidadeContent({ oportunidade, open, onClose, onConverter, windowMode = false,
  canonical = false, locais = [], obras = [], initialConversion = {}, quoteNumero = null }) {
  const [tipoConversao, setTipoConversao] = useState("orcamento");
  const [operation,setOperation]=useState({tipo_operacao:'RETIRADA',data_entrega_solicitada:'',cliente_local_id:'',obra_id:'',...initialConversion});
  const [pending,setPending]=useState(false),[error,setError]=useState(''),[result,setResult]=useState(null);
  const {grupoAtual,empresaAtual}=useContextoVisual();
  const guard=useCadastroFormScopeGuard(grupoAtual?.id||empresaAtual?.group_id||empresaAtual?.grupo_id,empresaAtual?.id||null);
  const gate=useRef(null);if(!gate.current)gate.current=createCrmFormSubmissionGate();
  if(!guard.isCurrent())return <div className="p-4 bg-blue-50 border border-blue-200 rounded">
    <p role="alert">Contexto alterado. Feche e reabra a conversão no contexto atual.</p>
    <Button type="button" variant="outline" onClick={onClose}>Fechar</Button>
  </div>;

  const handleConverter = async () => {
    setError('');
    try{
      const payload=canonical?buildCrmQuoteOrderCommand(oportunidade,operation):{oportunidade,tipoConversao};
      const saved=await gate.current.run({payload,assertCurrent:guard.assertCurrent,onPending:setPending,
        submit:data=>canonical?onConverter(data):onConverter(data.oportunidade,data.tipoConversao)});
      if(canonical)validateCrmQuoteOrderResult(oportunidade,saved,{groupId:grupoAtual?.id||empresaAtual?.group_id||empresaAtual?.grupo_id,empresaId:empresaAtual?.id||null});
      setResult(saved||{completed:true});
    }catch(failure){setError(failure?.name==='TypeError'?'Resposta não confirmada. O Pedido pode ter sido criado; consulte o registro antes de repetir.':failure?.message||'Falha na conversão. Consulte o registro antes de repetir.');}
  };

  const formContent = (
    <div className="space-y-4">
          <div className="p-4 bg-green-50 rounded border border-green-200">
            <div className="flex items-center gap-3 mb-3">
              <CheckCircle className="w-6 h-6 text-green-600" />
              <div>
                <h4 className="font-semibold text-green-900">Pronto para Converter!</h4>
                <p className="text-sm text-green-700">
                  A oportunidade será convertida em um documento de venda
                </p>
              </div>
            </div>
          </div>

          <div>
            <Label>Oportunidade</Label>
            <div className="p-3 bg-slate-50 rounded">
              <p className="font-semibold">{oportunidade?.titulo}</p>
              <p className="text-sm text-slate-600">{oportunidade?.cliente_nome}</p>
              <p className="text-sm text-green-600 font-semibold mt-1">
                Valor: R$ {Number(oportunidade?.valor_estimado || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>

          {!canonical && <div>
            <Label>Converter em *</Label>
            <Select value={tipoConversao} onValueChange={setTipoConversao}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="orcamento">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-600" />
                    <div>
                      <p className="font-semibold">Orçamento</p>
                      <p className="text-xs text-slate-600">Gerar proposta formal para o cliente</p>
                    </div>
                  </div>
                </SelectItem>
                <SelectItem value="pedido">
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="w-4 h-4 text-green-600" />
                    <div>
                      <p className="font-semibold">Pedido Direto</p>
                      <p className="text-xs text-slate-600">Converter diretamente em pedido</p>
                    </div>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>}

          {canonical && <div className="space-y-3 border border-blue-200 bg-blue-50 p-3 rounded">
            <p className="text-sm text-blue-900">Criar Pedido a partir do Orçamento já vinculado. Os preços gravados serão preservados.</p>
            <p className="text-sm">Oportunidade: {oportunidade?.codigo||oportunidade?.codigo_oportunidade||'Sem código'}</p>
            <p className="text-sm">Orçamento {quoteNumero||'vinculado'} <span className="text-xs font-mono text-slate-500" title="ID técnico do Orçamento">· ID {String(oportunidade?.orcamento_id||'').slice(0,8)}</span></p>
            <Label>Operação *</Label>
            <Select disabled={pending||Boolean(result)} value={operation.tipo_operacao} onValueChange={value=>setOperation({...operation,tipo_operacao:value})}>
              <SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
                <SelectItem value="RETIRADA">Retirada</SelectItem><SelectItem value="ENTREGA">Entrega</SelectItem>
              </SelectContent>
            </Select>
            <Label>Data e hora solicitadas pelo cliente *</Label>
            <Input type="datetime-local" disabled={pending||Boolean(result)} value={operation.data_entrega_solicitada} onChange={event=>setOperation({...operation,data_entrega_solicitada:event.target.value})} />
            {operation.tipo_operacao==='ENTREGA' && <>
              <Label>Local do cliente *</Label>
              <Select disabled={pending||Boolean(result)} value={operation.cliente_local_id} onValueChange={value=>setOperation({...operation,cliente_local_id:value})}>
                <SelectTrigger><SelectValue placeholder="Selecione o local" /></SelectTrigger><SelectContent>
                  {locais.filter(local=>local.ativo).map(local=><SelectItem key={local.id} value={local.id}>{local.nome||local.cidade||'Local'} · {local.codigo||'Sem código'}</SelectItem>)}
                </SelectContent>
              </Select>
            </>}
            <Label>Obra (opcional)</Label>
            <Select disabled={pending||Boolean(result)} value={operation.obra_id||'none'} onValueChange={value=>setOperation({...operation,obra_id:value==='none'?'':value})}>
              <SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
                <SelectItem value="none">Sem Obra</SelectItem>
                {obras.filter(obra=>obra.ativo).map(obra=><SelectItem key={obra.id} value={obra.id}>{obra.nome} · {obra.codigo||'Sem código'}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>}

          <div className="p-3 bg-blue-50 rounded border border-blue-200">
            <h4 className="text-sm font-semibold text-blue-900 mb-2">
              O que acontecerá:
            </h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li className="flex items-start gap-2">
                <ArrowRight className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>Um novo {canonical?'pedido':tipoConversao === "orcamento" ? "orçamento" : "pedido"} será criado</span>
              </li>
              <li className="flex items-start gap-2">
                <ArrowRight className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{canonical?'Os itens e preços do Orçamento vinculado serão preservados':'Os dados da oportunidade serão transferidos'}</span>
              </li>
              <li className="flex items-start gap-2">
                <ArrowRight className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>A oportunidade será marcada como "Ganho"</span>
              </li>
              <li className="flex items-start gap-2">
                <ArrowRight className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>Você poderá editar os detalhes na tela de {canonical?'pedido':tipoConversao === "orcamento" ? "orçamento" : "pedido"}</span>
              </li>
            </ul>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
              Cancelar
            </Button>
            <Button 
              onClick={handleConverter}
              disabled={pending||Boolean(result)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              {pending?'Convertendo…':'Converter Agora'}
            </Button>
          </div>
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          {result && <p role="status" className="text-sm text-blue-900">{canonical?`Pedido ${result.pedido?.numero||''} ${result.replayed?'já criado':'criado'} e vinculado.`:'Conversão concluída.'}</p>}
        </div>
  );

  if (windowMode) {
    return (
      <div className="w-full h-full overflow-auto bg-white p-6">
        {formContent}
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Converter Oportunidade em Venda</DialogTitle>
        </DialogHeader>
        {formContent}
      </DialogContent>
    </Dialog>
  );
}
