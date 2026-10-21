import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Shield, CheckCircle2, Clock, User } from 'lucide-react';

/**
 * Aba 8: Auditoria e Aprovação
 */
export default function AuditoriaAprovacaoTab({ formData, pedido }) {
  return (
    <div className="space-y-6">
      {/* Status de Aprovação */}
      <Card>
        <CardHeader className="bg-slate-50 border-b">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-600" />
            Status de Aprovação
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
              <div>
                <p className="font-semibold text-slate-900">Status Atual</p>
                <p className="text-sm text-slate-600">
                  {formData.aprovacao_necessaria 
                    ? 'Pedido requer aprovação'
                    : 'Pedido não requer aprovação'
                  }
                </p>
              </div>
              <Badge className={
                formData.status === 'Aprovado' ? 'bg-green-600' :
                formData.status === 'Aguardando Aprovação' ? 'bg-orange-600' :
                'bg-slate-600'
              }>
                {formData.status}
              </Badge>
            </div>

            {formData.aprovador && (
              <div className="flex items-center gap-3 p-4 bg-green-50 rounded-lg border border-green-300">
                <CheckCircle2 className="w-6 h-6 text-green-600" />
                <div>
                  <p className="font-semibold text-green-900">Aprovado por</p>
                  <p className="text-sm text-green-700">
                    {formData.aprovador} em {new Date(formData.data_aprovacao).toLocaleString('pt-BR')}
                  </p>
                  {formData.aprovacao_observacoes && (
                    <p className="text-xs text-green-600 mt-1">
                      {formData.aprovacao_observacoes}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Histórico de Alterações */}
      {pedido && pedido.historico && pedido.historico.length > 0 && (
        <Card>
          <CardHeader className="bg-slate-50 border-b">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="w-5 h-5 text-sky-600" />
              Histórico de Alterações
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y max-h-96 overflow-y-auto">
              {pedido.historico.map((log, index) => (
                <div key={index} className="p-4 hover:bg-slate-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-xs">
                          {log.acao}
                        </Badge>
                        {log.usuario && (
                          <span className="text-xs text-slate-600">
                            <User className="w-3 h-3 inline mr-1" />
                            {log.usuario}
                          </span>
                        )}
                      </div>
                      {log.campo && (
                        <p className="text-sm text-slate-700">
                          <strong>{log.campo}:</strong> {log.valor_anterior} → {log.valor_novo}
                        </p>
                      )}
                      {log.observacao && (
                        <p className="text-xs text-slate-600 mt-1">{log.observacao}</p>
                      )}
                    </div>
                    <span className="text-xs text-slate-500">
                      {new Date(log.data).toLocaleString('pt-BR')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Informações de Criação */}
      {pedido && (
        <Card>
          <CardHeader className="bg-slate-50 border-b">
            <CardTitle className="text-base">📝 Informações de Criação</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-slate-600">Criado em</p>
                <p className="font-semibold">
                  {new Date(pedido.created_date).toLocaleString('pt-BR')}
                </p>
              </div>
              <div>
                <p className="text-slate-600">Última atualização</p>
                <p className="font-semibold">
                  {new Date(pedido.updated_date).toLocaleString('pt-BR')}
                </p>
              </div>
              {pedido.created_by && (
                <div className="col-span-2">
                  <p className="text-slate-600">Criado por</p>
                  <p className="font-semibold">{pedido.created_by}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
