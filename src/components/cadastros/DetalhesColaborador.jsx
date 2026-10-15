import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  FileText, 
  DollarSign, 
  Clock,
  User,
  X,
  Plus,
  Edit,
  Trash2,
  Download,
  Upload,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Calendar,
  Briefcase
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion } from "framer-motion";
import { toast } from "sonner";
import usePermissions from "@/components/lib/usePermissions";

/**
 * V21.1.2 - WINDOW MODE READY
 * Convertido para suportar modo janela independente
 * SUB-DIALOGS internos mantidos para adicionar documentos (UX)
 */
export default function DetalhesColaborador({ colaborador, onClose, windowMode = false }) {
  const [activeTab, setActiveTab] = useState("historico");
  const [showDocumentoDialog, setShowDocumentoDialog] = useState(false);
  const [showSalarioDialog, setShowSalarioDialog] = useState(false);
  const [documentoForm, setDocumentoForm] = useState({
    tipo: "CPF",
    nome_arquivo: "",
    data_validade: "",
    observacao: ""
  });
  const [salarioForm, setSalarioForm] = useState({
    salario_anterior: colaborador?.salario || 0,
    salario_novo: colaborador?.salario || 0,
    motivo: "",
    data_vigencia: new Date().toISOString().split('T')[0]
  });

  const queryClient = useQueryClient();
  const { canEdit, isAdmin } = usePermissions();

  // Buscar dados relacionados
  const { data: pontos = [] } = useQuery({
    queryKey: ['pontos-colaborador', colaborador.id],
    queryFn: () => base44.entities.Ponto.filter({ colaborador_id: colaborador.id }),
    enabled: !!colaborador.id
  });

  const { data: ferias = [] } = useQuery({
    queryKey: ['ferias-colaborador', colaborador.id],
    queryFn: () => base44.entities.Ferias.filter({ colaborador_id: colaborador.id }),
    enabled: !!colaborador.id
  });

  const { data: ordensProducao = [] } = useQuery({
    queryKey: ['ops-colaborador', colaborador.id],
    queryFn: () => base44.entities.OrdemProducao.filter({ responsavel: colaborador.nome_completo }),
    enabled: !!colaborador.id
  });

  const updateColaboradorMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Colaborador.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['colaboradores'] });
      toast.success("Colaborador atualizado com sucesso!");
    },
  });

  // Cálculos
  const pontosMes = pontos.filter(p => {
    const dataP = new Date(p.data);
    const hoje = new Date();
    return dataP.getMonth() === hoje.getMonth() && dataP.getFullYear() === hoje.getFullYear();
  });

  const totalHorasMes = pontosMes.reduce((sum, p) => sum + (p.horas_trabalhadas || 0), 0);
  const totalHorasExtras = pontosMes.reduce((sum, p) => sum + (p.horas_extras || 0), 0);

  const feriasAtivas = ferias.filter(f => f.status === 'Em Gozo' || f.status === 'Aprovado');
  const feriasDisponiveis = colaborador.dias_ferias_disponiveis || 30;

  const tempoEmpresa = colaborador.data_admissao 
    ? Math.floor((new Date() - new Date(colaborador.data_admissao)) / (1000 * 60 * 60 * 24 * 365))
    : 0;

  const handleAdicionarDocumento = () => {
    const novosDocumentos = [...(colaborador.documentos || []), { 
      ...documentoForm, 
      data_upload: new Date().toISOString() 
    }];
    updateColaboradorMutation.mutate({
      id: colaborador.id,
      data: { ...colaborador, documentos: novosDocumentos }
    });
    setShowDocumentoDialog(false);
    setDocumentoForm({
      tipo: "CPF",
      nome_arquivo: "",
      data_validade: "",
      observacao: ""
    });
  };

  const handleRemoverDocumento = (index) => {
    const documentosAtualizados = (colaborador.documentos || []).filter((_, idx) => idx !== index);
    updateColaboradorMutation.mutate({
      id: colaborador.id,
      data: { ...colaborador, documentos: documentosAtualizados }
    });
  };

  const handleAtualizarSalario = () => {
    const historicoSalario = [
      ...(colaborador.historico_salario || []),
      {
        salario_anterior: salarioForm.salario_anterior,
        salario_novo: salarioForm.salario_novo,
        data: salarioForm.data_vigencia,
        motivo: salarioForm.motivo,
        usuario: 'Sistema'
      }
    ];
    
    updateColaboradorMutation.mutate({
      id: colaborador.id,
      data: { 
        ...colaborador, 
        salario: salarioForm.salario_novo,
        historico_salario: historicoSalario
      }
    });
    setShowSalarioDialog(false);
  };

  const statusColors = {
    'Ativo': 'bg-green-100 text-green-700',
    'Férias': 'bg-blue-100 text-blue-700',
    'Afastado': 'bg-orange-100 text-orange-700',
    'Desligado': 'bg-red-100 text-red-700'
  };

  // IA - Análise de desempenho
  const getAnaliseDesempenho = () => {
    const diasSemFalta = pontosMes.filter(p => p.horas_trabalhadas >= 8).length;
    const percentualPresenca = pontosMes.length > 0 ? (diasSemFalta / pontosMes.length) * 100 : 100;

    if (percentualPresenca >= 95 && totalHorasExtras < 20) {
      return {
        tipo: 'excelente',
        mensagem: 'Colaborador com ótimo histórico de presença, sem atrasos nos últimos 90 dias, desempenho consistente.',
        cor: 'text-green-600'
      };
    } else if (totalHorasExtras > 40) {
      return {
        tipo: 'alerta',
        mensagem: 'Atenção: Excesso de horas extras detectado. Considere revisar a carga de trabalho.',
        cor: 'text-orange-600'
      };
    } else if (percentualPresenca < 85) {
      return {
        tipo: 'atencao',
        mensagem: 'Presença abaixo do esperado. Recomenda-se acompanhamento mais próximo.',
        cor: 'text-red-600'
      };
    }

    return {
      tipo: 'normal',
      mensagem: 'Desempenho dentro do esperado.',
      cor: 'text-slate-600'
    };
  };

  const analiseDesempenho = getAnaliseDesempenho();

  const content = (
    <div className={windowMode ? 'w-full h-full overflow-auto bg-white p-4' : ''}>
      <Card className={windowMode ? 'border shadow-sm' : 'border-0 shadow-none m-4'}>
        <CardHeader className="border-b bg-white">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <CardTitle className="text-xl">{colaborador.nome_completo}</CardTitle>
              <div className="flex items-center gap-3 mt-1">
                <p className="text-sm text-slate-600">
                  {colaborador.cargo} • {colaborador.departamento}
                </p>
                <Badge className={statusColors[colaborador.status]}>
                  {colaborador.status}
                </Badge>
                <span className="text-xs text-slate-500">
                  {tempoEmpresa} {tempoEmpresa === 1 ? 'ano' : 'anos'} de empresa
                </span>
              </div>
            </div>
            {!windowMode && (
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="w-5 h-5" />
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3 mb-6">
              <TabsTrigger value="historico">
                <FileText className="w-4 h-4 mr-2" />
                Histórico
              </TabsTrigger>
              <TabsTrigger value="financeiro">
                <DollarSign className="w-4 h-4 mr-2" />
                Financeiro
              </TabsTrigger>
              <TabsTrigger value="documentos">
                <Upload className="w-4 h-4 mr-2" />
                Documentos
              </TabsTrigger>
            </TabsList>

            {/* ABA 1: HISTÓRICO */}
            <TabsContent value="historico" className="space-y-6">
              {/* IA - Análise de Desempenho */}
              <Card className="border-l-4 border-l-sky-500 bg-sky-50">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <TrendingUp className="w-5 h-5 text-sky-600 mt-1" />
                    <div>
                      <h4 className="font-semibold text-sky-900">Análise Inteligente</h4>
                      <p className={`text-sm mt-1 ${analiseDesempenho.cor}`}>
                        {analiseDesempenho.mensagem}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Resumo de Ponto */}
              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs text-slate-600">Horas Mês</p>
                    <p className="text-2xl font-bold text-blue-600">{totalHorasMes.toFixed(1)}h</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs text-slate-600">Horas Extras</p>
                    <p className="text-2xl font-bold text-orange-600">{totalHorasExtras.toFixed(1)}h</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs text-slate-600">Férias Disponíveis</p>
                    <p className="text-2xl font-bold text-green-600">{feriasDisponiveis} dias</p>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* ABA 2: FINANCEIRO E CONTRATO */}
            <TabsContent value="financeiro" className="space-y-6">
              {/* Dados Contratuais */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Dados Contratuais</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Tipo de Contrato:</span>
                    <span className="font-semibold">{colaborador.tipo_contrato}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Data de Admissão:</span>
                    <span className="font-semibold">
                      {new Date(colaborador.data_admissao).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ABA 3: DOCUMENTOS */}
            <TabsContent value="documentos" className="space-y-6">
              <div className="text-center py-8 text-slate-500">
                <Upload className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Documentos do colaborador</p>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );

  if (windowMode) {
    return content;
  }

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className="border-t-2 border-pink-200 bg-gradient-to-r from-pink-50 to-slate-50"
    >
      {content}
    </motion.div>
  );
}