import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, User, Edit, DollarSign, AlertTriangle, Package, MapPin, CheckCircle2 } from "lucide-react";

const iconesPorAcao = {
  criacao: Package,
  alteracao: Edit,
  aprovacao: CheckCircle2,
  desconto_aplicado: DollarSign,
  tabela_trocada: DollarSign,
  margem_violada: AlertTriangle,
  endereco_alterado: MapPin,
  item_adicionado: Package,
  item_removido: Package,
  item_producao_criado: Package,
  item_producao_enviado: Package,
  tabela_aplicada_automaticamente: DollarSign,
  tabela_removida: DollarSign
};

const coresPorAcao = {
  criacao: "text-green-600 bg-green-50",
  alteracao: "text-blue-600 bg-blue-50",
  aprovacao: "text-sky-600 bg-sky-50",
  desconto_aplicado: "text-orange-600 bg-orange-50",
  tabela_trocada: "text-cyan-600 bg-cyan-50",
  margem_violada: "text-red-600 bg-red-50",
  endereco_alterado: "text-sky-700 bg-sky-50",
  item_adicionado: "text-green-600 bg-green-50",
  item_removido: "text-red-600 bg-red-50",
  item_producao_criado: "text-blue-600 bg-blue-50",
  item_producao_enviado: "text-sky-600 bg-sky-50",
  tabela_aplicada_automaticamente: "text-green-600 bg-green-50",
  tabela_removida: "text-orange-600 bg-orange-50"
};

export default function HistoricoAlteracoesPedido({ historico = [] }) {
  if (!historico || historico.length === 0) {
    return (
      <Card className="border-0 shadow-sm">
        <CardContent className="p-8 text-center text-slate-500">
          <Clock className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Nenhuma alteração registrada ainda</p>
          <p className="text-xs mt-1">O histórico será criado automaticamente conforme você fizer alterações</p>
        </CardContent>
      </Card>
    );
  }

  const historicoOrdenado = [...historico].sort((a, b) => 
    new Date(b.data) - new Date(a.data)
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-slate-900 flex items-center gap-2">
          <Clock className="w-5 h-5 text-blue-600" />
          Histórico de Alterações
        </h3>
        <Badge variant="outline">{historico.length} eventos</Badge>
      </div>

      <div className="space-y-2">
        {historicoOrdenado.map((evento, idx) => {
          const Icone = iconesPorAcao[evento.acao] || Edit;
          const cores = coresPorAcao[evento.acao] || "text-slate-600 bg-slate-50";

          return (
            <Card key={idx} className="border-0 shadow-sm hover:shadow-md transition-all">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${cores}`}>
                    <Icone className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-semibold text-slate-900 capitalize">
                          {evento.acao.replace(/_/g, ' ')}
                        </p>
                        {evento.campo && (
                          <p className="text-sm text-slate-600 mt-1">
                            Campo: <span className="font-medium">{evento.campo}</span>
                          </p>
                        )}
                        {evento.valor_anterior && (
                          <p className="text-sm text-slate-600">
                            De: <span className="font-medium text-red-600">{evento.valor_anterior}</span>
                          </p>
                        )}
                        {evento.valor_novo && (
                          <p className="text-sm text-slate-600">
                            Para: <span className="font-medium text-green-600">{evento.valor_novo}</span>
                          </p>
                        )}
                        {evento.observacao && (
                          <p className="text-sm text-slate-700 mt-2 italic bg-slate-50 p-2 rounded">
                            {evento.observacao}
                          </p>
                        )}
                        {evento.detalhes && (
                          <div className="mt-2 p-2 bg-slate-50 rounded text-xs">
                            <pre className="text-slate-600 whitespace-pre-wrap">
                              {JSON.stringify(evento.detalhes, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                      <div className="text-right text-xs text-slate-500 ml-4">
                        <div className="flex items-center gap-1 mb-1">
                          <Clock className="w-3 h-3" />
                          {new Date(evento.data).toLocaleString('pt-BR')}
                        </div>
                        {evento.usuario && (
                          <div className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {evento.usuario}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}