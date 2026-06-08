import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  FileDown, 
  FileText, 
  Sheet, 
  CheckCircle2,
  TrendingUp,
  Users,
  Package,
  Truck,
  DollarSign,
  FileSpreadsheet,
  Building,
  Settings
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useContextoVisual } from '@/components/lib/useContextoVisual';
import usePermissions from '@/components/lib/usePermissions';
import { useUser } from '@/components/lib/UserContext';
import {
  exportarPedidosExcel,
  exportarClientesExcel,
  exportarContasReceberExcel,
  exportarContasPagarExcel,
  exportarEstoqueExcel,
  exportarMovimentacoesExcel,
  exportarDREExcel,
  exportarOrdensProducaoExcel,
  exportarEntregasExcel,
  exportarNotasFiscaisExcel,
  exportarFornecedoresExcel,
  exportarColaboradoresExcel
} from '../lib/exportacaoExcel';

import {
  gerarPDFPedido,
  gerarPDFRomaneio,
  gerarPDFNotaFiscal,
  gerarPDFOrdemProducao,
  gerarPDFRelatorio
} from '../lib/exportacaoPDF';

/**
 * Central de Geração de Relatórios e Exportações
 */
export default function GeradorRelatorios({ empresaId }) {
  const [gerando, setGerando] = useState(null);
  const { toast } = useToast();
  const { contexto, empresaAtual, grupoAtual, filterInContext, createInContext } = useContextoVisual();
  const { hasPermission } = usePermissions();
  const { user } = useUser();
  const scopeId = empresaId || empresaAtual?.id || grupoAtual?.id || 'sem-contexto';
  const contextoValido = scopeId !== 'sem-contexto';
  const canViewRelatorios = hasPermission('Sistema', 'Relatorios', 'visualizar') ||
    hasPermission('Relatorios', null, 'visualizar') ||
    hasPermission('Sistema', null, 'visualizar');
  const canExportRelatorios = hasPermission('Sistema', 'Relatorios', 'exportar') ||
    hasPermission('Relatorios', null, 'exportar') ||
    hasPermission('Sistema', null, 'exportar');

  const listar = (entityName, order, limit, campo) => (
    filterInContext(entityName, {}, order, limit, campo)
  );

  const { data: empresa } = useQuery({
    queryKey: ['empresa', empresaId, empresaAtual?.id, grupoAtual?.id, contexto],
    queryFn: () => filterInContext('Empresa', empresaId ? { id: empresaId } : {}, 'nome_fantasia', 1),
    enabled: contextoValido,
    select: (data) => data[0]
  });

  const relatoriosDisponiveis = [
    {
      id: 'pedidos',
      titulo: 'Pedidos',
      descricao: 'Lista completa de pedidos',
      icon: FileText,
      cor: 'blue',
      exportaExcel: async () => {
        const pedidos = await listar('Pedido', '-data_pedido', 9999);
        exportarPedidosExcel(pedidos);
      }
    },
    {
      id: 'clientes',
      titulo: 'Clientes',
      descricao: 'Cadastro completo de clientes',
      icon: Users,
      cor: 'purple',
      exportaExcel: async () => {
        const clientes = await listar('Cliente', '-created_date', 9999);
        exportarClientesExcel(clientes);
      }
    },
    {
      id: 'contas-receber',
      titulo: 'Contas a Receber',
      descricao: 'Títulos e recebimentos',
      icon: DollarSign,
      cor: 'green',
      exportaExcel: async () => {
        const contas = await listar('ContaReceber', '-data_vencimento', 9999);
        exportarContasReceberExcel(contas);
      }
    },
    {
      id: 'contas-pagar',
      titulo: 'Contas a Pagar',
      descricao: 'Títulos e pagamentos',
      icon: DollarSign,
      cor: 'red',
      exportaExcel: async () => {
        const contas = await listar('ContaPagar', '-data_vencimento', 9999);
        exportarContasPagarExcel(contas);
      }
    },
    {
      id: 'estoque',
      titulo: 'Estoque',
      descricao: 'Posição de estoque',
      icon: Package,
      cor: 'orange',
      exportaExcel: async () => {
        const produtos = await listar('Produto', '-created_date', 9999);
        exportarEstoqueExcel(produtos);
      }
    },
    {
      id: 'movimentacoes',
      titulo: 'Movimentações de Estoque',
      descricao: 'Histórico de movimentações',
      icon: TrendingUp,
      cor: 'cyan',
      exportaExcel: async () => {
        const movs = await listar('MovimentacaoEstoque', '-data_movimentacao', 1000);
        exportarMovimentacoesExcel(movs);
      }
    },
    {
      id: 'producao',
      titulo: 'Ordens de Produção',
      descricao: 'OPs e apontamentos',
      icon: Settings,
      cor: 'indigo',
      exportaExcel: async () => {
        const ops = await listar('OrdemProducao', '-data_emissao', 9999);
        exportarOrdensProducaoExcel(ops);
      }
    },
    {
      id: 'entregas',
      titulo: 'Entregas',
      descricao: 'Log de entregas realizadas',
      icon: Truck,
      cor: 'pink',
      exportaExcel: async () => {
        const entregas = await listar('Entrega', '-created_date', 9999);
        exportarEntregasExcel(entregas);
      }
    },
    {
      id: 'nfe',
      titulo: 'Notas Fiscais',
      descricao: 'NF-e emitidas',
      icon: FileText,
      cor: 'teal',
      exportaExcel: async () => {
        const nfes = await listar('NotaFiscal', '-data_emissao', 9999, 'empresa_faturamento_id');
        exportarNotasFiscaisExcel(nfes);
      }
    },
    {
      id: 'fornecedores',
      titulo: 'Fornecedores',
      descricao: 'Cadastro de fornecedores',
      icon: Building,
      cor: 'slate',
      exportaExcel: async () => {
        const fornecedores = await listar('Fornecedor', '-created_date', 9999);
        exportarFornecedoresExcel(fornecedores);
      }
    },
    {
      id: 'colaboradores',
      titulo: 'Colaboradores',
      descricao: 'Cadastro de funcionários',
      icon: Users,
      cor: 'violet',
      exportaExcel: async () => {
        const colaboradores = await listar('Colaborador', '-created_date', 9999, 'empresa_alocada_id');
        exportarColaboradoresExcel(colaboradores);
      }
    },
    {
      id: 'dre',
      titulo: 'DRE',
      descricao: 'Demonstração do Resultado',
      icon: FileSpreadsheet,
      cor: 'emerald',
      exportaExcel: async () => {
        const dres = await listar('DRE', '-periodo', 9999);
        if (dres.length > 0) {
          exportarDREExcel(dres[0]);
        } else {
          throw new Error('Nenhum DRE encontrado');
        }
      }
    }
  ];

  const handleExportarExcel = async (relatorio) => {
    setGerando(relatorio.id);
    try {
      if (!contextoValido) {
        throw new Error('Selecione um grupo ou empresa antes de exportar.');
      }
      if (!canExportRelatorios) {
        await createInContext('AuditLog', {
          acao: 'bloqueio_exportacao_relatorio',
          modulo: 'Sistema',
          entidade: 'GeradorRelatorios',
          entidade_id: relatorio.id,
          descricao: `Exportacao bloqueada por RBAC: ${relatorio.titulo}`,
          usuario_id: user?.id || null,
          usuario: user?.email || user?.full_name || 'Usuario',
          empresa_id: empresaAtual?.id || empresaId || null,
          group_id: grupoAtual?.id || empresaAtual?.group_id || null,
          grupo_id: grupoAtual?.id || empresaAtual?.group_id || null,
          tipo_auditoria: 'seguranca',
          sucesso: false,
          data_hora: new Date().toISOString()
        });
        throw new Error('Usuario sem permissao para exportar relatorios.');
      }
      await relatorio.exportaExcel();
      await createInContext('AuditLog', {
        acao: 'exportar_relatorio',
        modulo: 'Sistema',
        entidade: 'GeradorRelatorios',
        entidade_id: relatorio.id,
        descricao: `Relatorio exportado: ${relatorio.titulo}`,
        usuario_id: user?.id || null,
        usuario: user?.email || user?.full_name || 'Usuario',
        empresa_id: empresaAtual?.id || empresaId || null,
        group_id: grupoAtual?.id || empresaAtual?.group_id || null,
        grupo_id: grupoAtual?.id || empresaAtual?.group_id || null,
        tipo_auditoria: 'operacional',
        sucesso: true,
        contexto,
        data_hora: new Date().toISOString()
      });
      toast({ 
        title: '✅ Excel Exportado!',
        description: `${relatorio.titulo} exportado com sucesso`
      });
    } catch (error) {
      console.error('Erro ao exportar:', error);
      toast({ 
        title: '❌ Erro ao exportar',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setGerando(null);
    }
  };

  return (
    <div
      className="space-y-6 w-full h-full"
      data-permission="Sistema.Relatorios.visualizar"
      data-context-required="group-or-company"
    >
      {(!contextoValido || !canViewRelatorios) && (
        <Alert className="border-amber-300 bg-amber-50">
          <AlertDescription>
            Selecione grupo ou empresa e confirme permissao para visualizar a central de relatorios.
          </AlertDescription>
        </Alert>
      )}
      <Alert className="border-blue-300 bg-blue-50">
        <FileDown className="w-5 h-5 text-blue-600" />
        <AlertDescription>
          <p className="font-semibold text-blue-900 mb-1">
            ✅ Exportação de Relatórios Implementada!
          </p>
          <p className="text-sm text-blue-800">
            Exporte qualquer relatório para <strong>Excel (CSV)</strong> ou <strong>PDF</strong>. 
            Os arquivos são gerados instantaneamente no navegador.
          </p>
        </AlertDescription>
      </Alert>

      <div className="grid md:grid-cols-3 gap-4">
        {relatoriosDisponiveis.map((relatorio) => {
          const Icon = relatorio.icon;
          const isGerando = gerando === relatorio.id;
          
          return (
            <Card key={relatorio.id} className="border-2 hover:shadow-lg transition-all">
              <CardHeader className={`border-b ${
                relatorio.cor === 'blue' ? 'bg-blue-50' :
                relatorio.cor === 'purple' ? 'bg-purple-50' :
                relatorio.cor === 'green' ? 'bg-green-50' :
                relatorio.cor === 'red' ? 'bg-red-50' :
                relatorio.cor === 'orange' ? 'bg-orange-50' :
                relatorio.cor === 'cyan' ? 'bg-cyan-50' :
                relatorio.cor === 'indigo' ? 'bg-indigo-50' :
                relatorio.cor === 'pink' ? 'bg-pink-50' :
                relatorio.cor === 'teal' ? 'bg-teal-50' :
                relatorio.cor === 'slate' ? 'bg-slate-50' :
                relatorio.cor === 'violet' ? 'bg-violet-50' :
                'bg-emerald-50'
              }`}>
                <CardTitle className={`flex items-center gap-2 text-base ${
                relatorio.cor === 'blue' ? 'text-blue-600' :
                relatorio.cor === 'purple' ? 'text-purple-600' :
                relatorio.cor === 'green' ? 'text-green-600' :
                relatorio.cor === 'red' ? 'text-red-600' :
                relatorio.cor === 'orange' ? 'text-orange-600' :
                relatorio.cor === 'cyan' ? 'text-cyan-600' :
                relatorio.cor === 'indigo' ? 'text-indigo-600' :
                relatorio.cor === 'pink' ? 'text-pink-600' :
                relatorio.cor === 'teal' ? 'text-teal-600' :
                relatorio.cor === 'slate' ? 'text-slate-600' :
                relatorio.cor === 'violet' ? 'text-violet-600' :
                'text-emerald-600'
              }`}>
                  <Icon className="w-5 h-5" />
                  {relatorio.titulo}
                </CardTitle>
                <p className="text-xs text-slate-600 mt-1">{relatorio.descricao}</p>
              </CardHeader>
              <CardContent className="p-4">
                <div className="flex gap-2">
                  <Button
                    onClick={() => handleExportarExcel(relatorio)}
                    disabled={isGerando || !contextoValido || !canExportRelatorios}
                    data-action={`Relatorios.exportar.${relatorio.id}`}
                    data-permission="Sistema.Relatorios.exportar"
                    data-context-required="group-or-company"
                    data-sensitive="true"
                    className={`flex-1 ${
                relatorio.cor === 'blue' ? 'bg-blue-600 hover:bg-blue-700' :
                relatorio.cor === 'purple' ? 'bg-purple-600 hover:bg-purple-700' :
                relatorio.cor === 'green' ? 'bg-green-600 hover:bg-green-700' :
                relatorio.cor === 'red' ? 'bg-red-600 hover:bg-red-700' :
                relatorio.cor === 'orange' ? 'bg-orange-600 hover:bg-orange-700' :
                relatorio.cor === 'cyan' ? 'bg-cyan-600 hover:bg-cyan-700' :
                relatorio.cor === 'indigo' ? 'bg-indigo-600 hover:bg-indigo-700' :
                relatorio.cor === 'pink' ? 'bg-pink-600 hover:bg-pink-700' :
                relatorio.cor === 'teal' ? 'bg-teal-600 hover:bg-teal-700' :
                relatorio.cor === 'slate' ? 'bg-slate-600 hover:bg-slate-700' :
                relatorio.cor === 'violet' ? 'bg-violet-600 hover:bg-violet-700' :
                'bg-emerald-600 hover:bg-emerald-700'
              }`}
                    size="sm"
                  >
                    {isGerando ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                        Gerando...
                      </>
                    ) : (
                      <>
                        <Sheet className="w-4 h-4 mr-2" />
                        Excel
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="border-0 shadow-md">
        <CardHeader className="bg-green-50 border-b">
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            Recursos Disponíveis
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
              <Sheet className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-green-900">Excel (CSV)</p>
                <p className="text-sm text-green-700">
                  Arquivos compatíveis com Excel, Google Sheets, LibreOffice. 
                  Suporta acentuação e formatação brasileira.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <FileText className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-blue-900">PDF Prontos</p>
                <p className="text-sm text-blue-700">
                  PDFs de Pedido, Romaneio, NF-e e OP disponíveis nos respectivos módulos.
                  Use os botões de exportação em cada tela.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-purple-50 rounded-lg border border-purple-200">
              <TrendingUp className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-purple-900">Dados em Tempo Real</p>
                <p className="text-sm text-purple-700">
                  Todas as exportações refletem os dados mais atualizados do sistema.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
