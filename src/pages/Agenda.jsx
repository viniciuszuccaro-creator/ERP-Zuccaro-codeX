import React, { useState, useMemo, useEffect, Suspense } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Calendar,
  Plus,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Users,
  Video,
  Bell,
  Edit,
  Trash2,
  CheckCircle,
  Info,
  RefreshCw,
  Link2,
  Mail,
  MessageSquare
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { Switch } from "@/components/ui/switch";
import EventoForm from "@/components/agenda/EventoForm";
import { useWindow } from "@/components/lib/useWindow";
import ErrorBoundary from "@/components/lib/ErrorBoundary";
import ProtectedSection from "@/components/security/ProtectedSection";
import { useContextoVisual } from "@/components/lib/useContextoVisual";


function Agenda() {
  const [visualizacao, setVisualizacao] = useState("mes");
  const [dataAtual, setDataAtual] = useState(new Date());
  const [eventoDialogOpen, setEventoDialogOpen] = useState(false);
  const [editingEvento, setEditingEvento] = useState(null);
  const [visualizandoEvento, setVisualizandoEvento] = useState(null);
  const [filtroUsuario, setFiltroUsuario] = useState("todos");
  const [syncGoogleDialogOpen, setSyncGoogleDialogOpen] = useState(false);

  // Navegação: restaurar estado inicial da URL/localStorage
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    let v = params.get('view');
    let d = params.get('date');
    let u = params.get('user');

    if (!v) { try { v = localStorage.getItem('Agenda_view') || null; } catch (error) { console.warn('[Agenda] Falha ao restaurar visualizacao', error); } }
    if (!d) { try { d = localStorage.getItem('Agenda_date') || null; } catch (error) { console.warn('[Agenda] Falha ao restaurar data', error); } }
    if (!u) { try { u = localStorage.getItem('Agenda_user') || null; } catch (error) { console.warn('[Agenda] Falha ao restaurar filtro de usuario', error); } }

    if (v) setVisualizacao(v);
    if (d) {
      const parsed = new Date(d);
      if (!isNaN(parsed)) setDataAtual(parsed);
    }
    if (u) setFiltroUsuario(u);
  }, []);

  // Sincronizar estado -> URL + localStorage
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('view', visualizacao);
    url.searchParams.set('date', dataAtual.toISOString().split('T')[0]);
    url.searchParams.set('user', filtroUsuario);
    window.history.replaceState({}, '', url.toString());
    try {
      localStorage.setItem('Agenda_view', visualizacao);
      localStorage.setItem('Agenda_date', dataAtual.toISOString());
      localStorage.setItem('Agenda_user', filtroUsuario);
    } catch (error) {
      console.warn('[Agenda] Falha ao persistir preferencias', error);
    }
  }, [visualizacao, dataAtual, filtroUsuario]);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { openWindow } = useWindow();
  const { filterInContext, carimbarContexto, updateInContext, empresaAtual } = useContextoVisual();

  const [eventoForm, setEventoForm] = useState({
    titulo: "",
    descricao: "",
    tipo: "Reunião",
    data_inicio: "",
    hora_inicio: "",
    data_fim: "",
    hora_fim: "",
    dia_inteiro: false,
    local: "",
    participantes: [],
    cliente_nome: "",
    pedido_id: "", // New field
    status: "Agendado",
    prioridade: "Normal",
    lembrete: true,
    tempo_lembrete: 30,
    link_reuniao: "",
    observacoes: "",
    cor: "#3b82f6",
    notificar_email: false, // New field
    notificar_whatsapp: false // New field
  });

  const { data: eventos = [] } = useQuery({
    queryKey: ['eventos', empresaAtual?.id],
    queryFn: () => filterInContext('Evento', {}, '-data_inicio'),
  });

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me(),
  });

  const { data: clientes = [] } = useQuery({
    queryKey: ['clientes', empresaAtual?.id],
    queryFn: () => filterInContext('Cliente', {}, '-created_date'),
  });

  const { data: pedidos = [] } = useQuery({
    queryKey: ['pedidos', empresaAtual?.id],
    queryFn: () => filterInContext('Pedido', {}, '-data_pedido'),
  });

  const { data: configuracoes } = useQuery({
    queryKey: ['configuracaoSistema'],
    queryFn: async () => {
      const configs = await base44.entities.ConfiguracaoSistema.list();
      return configs[0] || null; // Assuming there's only one system config or we take the first
    },
  });

  // Verificar lembretes pendentes e criar notificações
  useEffect(() => {
    const verificarLembretes = async () => {
      const agora = new Date();

      for (const evento of eventos) {
        if (!evento.lembrete || evento.status === 'Concluído' || evento.status === 'Cancelado') continue;

        const dataEvento = new Date(evento.data_inicio);
        const tempoLembrete = evento.tempo_lembrete || 30;
        const dataLembrete = new Date(dataEvento.getTime() - tempoLembrete * 60000);

        // Se o lembrete deve ser enviado agora (com margem de 5 minutos)
        // This margin helps ensure the reminder is caught even if the interval check isn't perfectly aligned
        if (agora >= dataLembrete && agora <= new Date(dataLembrete.getTime() + 5 * 60000)) {
          // Criar notificação (simulada via base44.entities.Notificacao)
          await base44.entities.Notificacao.create({
            titulo: `🔔 Lembrete: ${evento.titulo}`,
            mensagem: `Seu evento "${evento.titulo}" começa em ${tempoLembrete} minutos.\n\nData: ${dataEvento.toLocaleString('pt-BR')}\n${evento.local ? `Local: ${evento.local}` : ''}`,
            tipo: evento.prioridade === 'Urgente' ? 'urgente' : 'aviso',
            categoria: 'Geral',
            prioridade: evento.prioridade,
            destinatario_email: user?.email, // Assuming responsible user is the recipient
            link_acao: window.location.href, // Link back to the agenda page
            entidade_relacionada: 'Evento',
            registro_id: evento.id
          });

          toast({
            title: `🔔 ${evento.titulo}`,
            description: `Começa em ${tempoLembrete} minutos`,
          });
        }
      }
    };

    const interval = setInterval(verificarLembretes, 60000); // Verifica a cada 1 minuto
    verificarLembretes(); // Verifica imediatamente ao carregar

    return () => clearInterval(interval); // Limpa o intervalo ao desmontar o componente
  }, [eventos, user, toast]); // Dependências para re-executar o efeito

  const createEventoMutation = useMutation({
    mutationFn: async (data) => {
      const dataInicio = `${data.data_inicio}T${data.hora_inicio || '00:00'}:00`;
      const dataFim = `${data.data_fim}T${data.hora_fim || '23:59'}:00`;

      const evento = await base44.entities.Evento.create(carimbarContexto({
        ...data,
        data_inicio: dataInicio,
        data_fim: dataFim,
        responsavel: user?.full_name || 'Usuário',
        responsavel_id: user?.id
      }));

      // Criar notificação de novo evento para o criador, se configurado
      // ou se houver participantes (presumindo que o criador quer ser notificado sobre o evento que envolve outros)
      if ((data.participantes && data.participantes.length > 0) || data.notificar_email || data.notificar_whatsapp) {
        await base44.entities.Notificacao.create({
          titulo: `📅 Novo Evento: ${data.titulo}`,
          // Assuming the message is for the creator
          mensagem: `Você criou um novo evento: "${data.titulo}".\n\nData: ${new Date(dataInicio).toLocaleString('pt-BR')}\n${data.local ? `Local: ${data.local}` : ''}`,
          tipo: 'info',
          categoria: 'Geral',
          destinatario_email: user?.email,
          link_acao: window.location.href,
          entidade_relacionada: 'Evento',
          registro_id: evento.id
        });
        // In a real system, `notificar_email` and `notificar_whatsapp` flags
        // would trigger specific actions to send actual messages via a backend service.
      }

      return evento;
    },
    onSuccess: async (evento) => {
      await base44.entities.AuditLog.create({
        usuario: user?.full_name || user?.email || 'Usuário',
        usuario_id: user?.id,
        acao: 'Criação',
        modulo: 'Agenda',
        entidade: 'Evento',
        registro_id: evento?.id,
        descricao: `Evento ${evento?.titulo || ''} criado`,
      });
      queryClient.invalidateQueries({ queryKey: ['eventos'] });
      setEventoDialogOpen(false);
      resetForm();
      toast({
        title: "✅ Evento Criado!",
        description: "O evento foi adicionado à agenda"
      });
    },
  });

  const updateEventoMutation = useMutation({
    mutationFn: ({ id, data }) => {
      const dataInicio = `${data.data_inicio}T${data.hora_inicio || '00:00'}:00`;
      const dataFim = `${data.data_fim}T${data.hora_fim || '23:59'}:00`;

      return updateInContext('Evento', id, {
        ...data,
        data_inicio: dataInicio,
        data_fim: dataFim
      });
    },
    onSuccess: async (_res, { id, data }) => {
      await base44.entities.AuditLog.create({
        usuario: user?.full_name || user?.email || 'Usuário',
        usuario_id: user?.id,
        acao: 'Edição',
        modulo: 'Agenda',
        entidade: 'Evento',
        registro_id: id,
        descricao: `Evento ${data?.titulo || ''} atualizado`,
      });
      queryClient.invalidateQueries({ queryKey: ['eventos'] });
      setEventoDialogOpen(false);
      resetForm();
      toast({
        title: "✅ Evento Atualizado!",
        description: "As alterações foram salvas"
      });
    },
  });

  const deleteEventoMutation = useMutation({
    mutationFn: (id) => base44.entities.Evento.delete(id),
    onSuccess: async (_res, id) => {
      await base44.entities.AuditLog.create({
        usuario: user?.full_name || user?.email || 'Usuário',
        usuario_id: user?.id,
        acao: 'Exclusão',
        modulo: 'Agenda',
        entidade: 'Evento',
        registro_id: id,
        descricao: `Evento excluído`,
      });
      queryClient.invalidateQueries({ queryKey: ['eventos'] });
      setVisualizandoEvento(null);
      toast({
        title: "✅ Evento Excluído",
        description: "O evento foi removido da agenda"
      });
    },
  });

  const concluirEventoMutation = useMutation({
    mutationFn: (evento) => updateInContext('Evento', evento.id, {
      ...evento,
      status: 'Concluído'
    }),
    onSuccess: async (_res, evento) => {
      await base44.entities.AuditLog.create({
        usuario: user?.full_name || user?.email || 'Usuário',
        usuario_id: user?.id,
        acao: 'Edição',
        modulo: 'Agenda',
        entidade: 'Evento',
        registro_id: evento?.id,
        descricao: `Evento concluído`,
      });
      queryClient.invalidateQueries({ queryKey: ['eventos'] });
      toast({
        title: "✅ Evento Concluído!",
        description: "O evento foi marcado como concluído"
      });
    },
  });

  const sincronizarGoogleMutation = useMutation({
    mutationFn: async () => {
      toast({
        title: "🔄 Sincronizando...",
        description: "Conectando com Google Calendar"
      });

      await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate API call delay

      // Simular sincronização: criar um evento de exemplo
      const eventosGoogle = [
        {
          titulo: "Reunião Google Meet (Sync)",
          descricao: "Evento sincronizado do Google Calendar",
          tipo: "Reunião",
          data_inicio: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Tomorrow
          hora_inicio: "14:00",
          data_fim: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          hora_fim: "15:00",
          dia_inteiro: false,
          local: "Google Meet",
          participantes: [],
          cliente_nome: "Acme Corp",
          pedido_id: null,
          status: "Agendado",
          prioridade: "Normal",
          lembrete: true,
          tempo_lembrete: 15,
          link_reuniao: "https://meet.google.com/abc-defg-hij",
          observacoes: "Evento de demonstração de sincronização.",
          cor: "#4285f4", // Google Blue
          notificar_email: false,
          notificar_whatsapp: false,
          responsavel: user?.full_name, // Assign to current user
          responsavel_id: user?.id
        }
      ];

      for (const evt of eventosGoogle) {
        await base44.entities.Evento.create({
          ...evt,
          data_inicio: `${evt.data_inicio}T${evt.hora_inicio}:00`,
          data_fim: `${evt.data_fim}T${evt.hora_fim}:00`
        });
      }

      return eventosGoogle.length;
    },
    onSuccess: (quantidade) => {
      queryClient.invalidateQueries({ queryKey: ['eventos'] });
      setSyncGoogleDialogOpen(false);
      toast({
        title: "✅ Sincronização Concluída!",
        description: `${quantidade} evento(s) importado(s) do Google Calendar`
      });
    },
    onError: (error) => {
      toast({
        title: "❌ Erro na Sincronização",
        description: `Não foi possível sincronizar: ${error.message}`
      });
    }
  });


  const resetForm = () => {
    setEventoForm({
      titulo: "",
      descricao: "",
      tipo: "Reunião",
      data_inicio: "",
      hora_inicio: "",
      data_fim: "",
      hora_fim: "",
      dia_inteiro: false,
      local: "",
      participantes: [],
      cliente_nome: "",
      pedido_id: "", // Reset new field
      status: "Agendado",
      prioridade: "Normal",
      lembrete: true,
      tempo_lembrete: 30,
      link_reuniao: "",
      observacoes: "",
      cor: "#3b82f6",
      notificar_email: false, // Reset new field
      notificar_whatsapp: false // Reset new field
    });
    setEditingEvento(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingEvento) {
      updateEventoMutation.mutate({ id: editingEvento.id, data: eventoForm });
    } else {
      createEventoMutation.mutate(eventoForm);
    }
  };

  const handleEdit = (evento) => {
    const dataInicio = new Date(evento.data_inicio);
    const dataFim = new Date(evento.data_fim);

    setEditingEvento(evento);
    setEventoForm({
      ...evento,
      data_inicio: dataInicio.toISOString().split('T')[0],
      hora_inicio: dataInicio.toTimeString().substring(0, 5),
      data_fim: dataFim.toISOString().split('T')[0],
      hora_fim: dataFim.toTimeString().substring(0, 5)
    });
    setEventoDialogOpen(true);
  };

  const handleDelete = (evento) => {
    if (window.confirm(`Deseja realmente excluir o evento "${evento.titulo}"?`)) {
      deleteEventoMutation.mutate(evento.id);
    }
  };

  const handleConcluir = (evento) => {
    concluirEventoMutation.mutate(evento);
  };

  // Funções de navegação
  const navegarAnterior = () => {
    const novaData = new Date(dataAtual);
    if (visualizacao === 'mes') {
      novaData.setMonth(novaData.getMonth() - 1);
    } else if (visualizacao === 'semana') {
      novaData.setDate(novaData.getDate() - 7);
    } else {
      novaData.setDate(novaData.getDate() - 1);
    }
    setDataAtual(novaData);
  };

  const navegarProximo = () => {
    const novaData = new Date(dataAtual);
    if (visualizacao === 'mes') {
      novaData.setMonth(novaData.getMonth() + 1);
    } else if (visualizacao === 'semana') {
      novaData.setDate(novaData.getDate() + 7);
    } else {
      novaData.setDate(novaData.getDate() + 1);
    }
    setDataAtual(novaData);
  };

  const irParaHoje = () => {
    setDataAtual(new Date());
  };

  // Filtrar eventos
  const filteredEventos = useMemo(() => {
    let filtrados = eventos;

    if (filtroUsuario !== 'todos') {
      filtrados = filtrados.filter(e => e.responsavel === filtroUsuario);
    }

    return filtrados;
  }, [eventos, filtroUsuario]);

  // Obter eventos do período atual
  const eventosVisiveis = useMemo(() => {
    const inicio = new Date(dataAtual);
    const fim = new Date(dataAtual);

    if (visualizacao === 'mes') {
      inicio.setDate(1);
      inicio.setHours(0, 0, 0, 0);
      fim.setMonth(fim.getMonth() + 1);
      fim.setDate(0);
      fim.setHours(23, 59, 59, 999);
    } else if (visualizacao === 'semana') {
      const diaSemana = inicio.getDay(); // 0 for Sunday, 6 for Saturday
      inicio.setDate(inicio.getDate() - diaSemana);
      inicio.setHours(0, 0, 0, 0);
      fim.setDate(inicio.getDate() + 6);
      fim.setHours(23, 59, 59, 999);
    } else { // visualizacao === 'dia'
      inicio.setHours(0, 0, 0, 0);
      fim.setHours(23, 59, 59, 999);
    }

    return filteredEventos.filter(e => {
      const dataEvento = new Date(e.data_inicio);
      return dataEvento >= inicio && dataEvento <= fim;
    });
  }, [filteredEventos, dataAtual, visualizacao]);

  // Renderizar calendário mensal
  const renderCalendarioMensal = () => {
    const primeiroDia = new Date(dataAtual.getFullYear(), dataAtual.getMonth(), 1);
    const ultimoDia = new Date(dataAtual.getFullYear(), dataAtual.getMonth() + 1, 0);
    const diasMes = ultimoDia.getDate();
    const diaSemanaInicio = primeiroDia.getDay(); // 0 for Sunday, 6 for Saturday

    const dias = [];

    // Dias do mês anterior para preencher o início da semana
    for (let i = 0; i < diaSemanaInicio; i++) {
      dias.push(null);
    }

    // Dias do mês atual
    for (let i = 1; i <= diasMes; i++) {
      dias.push(i);
    }

    // Organizar dias em semanas
    const semanas = [];
    for (let i = 0; i < dias.length; i += 7) {
      semanas.push(dias.slice(i, i + 7));
    }

    return (
      <div className="grid grid-cols-7 gap-2">
        {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(dia => (
          <div key={dia} className="text-center font-semibold text-sm text-slate-600 p-2">
            {dia}
          </div>
        ))}
        {semanas.map((semana, semanaIdx) => (
          <React.Fragment key={semanaIdx}>
            {semana.map((dia, diaIdx) => {
              if (!dia) {
                return <div key={diaIdx} className="min-h-24 p-2 bg-slate-50 rounded-lg" />;
              }

              const dataDia = new Date(dataAtual.getFullYear(), dataAtual.getMonth(), dia);
              const eventosDia = eventosVisiveis.filter(e => {
                const dataEvento = new Date(e.data_inicio);
                return dataEvento.getDate() === dia &&
                       dataEvento.getMonth() === dataAtual.getMonth() &&
                       dataEvento.getFullYear() === dataAtual.getFullYear();
              });

              const hoje = new Date();
              const ehHoje = dataDia.toDateString() === hoje.toDateString();

              return (
                <div
                  key={diaIdx}
                  className={`min-h-24 p-2 border rounded-lg ${
                    ehHoje ? 'bg-blue-50 border-blue-300 ring-2 ring-blue-200' : 'bg-white border-slate-200'
                  } hover:bg-slate-50 transition-colors cursor-pointer`}
                  onClick={() => {
                    setEventoForm({
                      ...eventoForm,
                      data_inicio: dataDia.toISOString().split('T')[0],
                      data_fim: dataDia.toISOString().split('T')[0]
                    });
                    setEventoDialogOpen(true);
                  }}
                >
                  <div className={`text-sm font-semibold mb-1 ${ehHoje ? 'text-blue-600' : 'text-slate-700'}`}>
                    {dia}
                  </div>
                  <div className="space-y-1">
                    {eventosDia.slice(0, 3).map(evento => (
                      <div
                        key={evento.id}
                        className="text-xs p-1 rounded truncate cursor-pointer hover:opacity-80"
                        style={{ backgroundColor: evento.cor + '20', color: evento.cor }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setVisualizandoEvento(evento);
                        }}
                      >
                        {evento.titulo}
                      </div>
                    ))}
                    {eventosDia.length > 3 && (
                      <div className="text-xs text-slate-500">
                        +{eventosDia.length - 3} mais
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>
    );
  };

  // Renderizar visualização semanal
  const renderVisaoSemanal = () => {
    const inicioDaSemana = new Date(dataAtual);
    inicioDaSemana.setDate(dataAtual.getDate() - dataAtual.getDay()); // Define para o domingo da semana atual

    const diasSemana = [];
    for (let i = 0; i < 7; i++) {
      const dia = new Date(inicioDaSemana);
      dia.setDate(inicioDaSemana.getDate() + i);
      diasSemana.push(dia);
    }

    const horas = Array.from({ length: 24 }, (_, i) => i);

    return (
      <div className="overflow-x-auto">
        <div className="min-w-full">
          <div className="grid grid-cols-8 gap-2">
            <div className="text-center font-semibold text-sm text-slate-600 p-2">Hora</div>
            {diasSemana.map((dia, idx) => {
              const hoje = new Date();
              const ehHoje = dia.toDateString() === hoje.toDateString();
              return (
                <div
                  key={idx}
                  className={`text-center p-2 rounded-t-lg ${
                    ehHoje ? 'bg-blue-50 font-bold text-blue-600' : ''
                  }`}
                >
                  <div className="text-xs">{['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][idx]}</div>
                  <div className="text-lg font-semibold">{dia.getDate()}</div>
                </div>
              );
            })}
          </div>
          {horas.map(hora => (
            <div key={hora} className="grid grid-cols-8 gap-2 border-t">
              <div className="text-xs text-slate-500 p-2 text-right">
                {hora.toString().padStart(2, '0')}:00
              </div>
              {diasSemana.map((dia, diaIdx) => {
                const eventosDaHora = eventosVisiveis.filter(e => {
                  const dataEvento = new Date(e.data_inicio);
                  return dataEvento.getDate() === dia.getDate() &&
                         dataEvento.getMonth() === dia.getMonth() &&
                         dataEvento.getFullYear() === dia.getFullYear() &&
                         dataEvento.getHours() === hora;
                });

                return (
                  <div
                    key={diaIdx}
                    className="min-h-12 p-1 hover:bg-slate-50 cursor-pointer"
                    onClick={() => {
                      const dataHora = new Date(dia);
                      dataHora.setHours(hora, 0, 0, 0);
                      setEventoForm({
                        ...eventoForm,
                        data_inicio: dataHora.toISOString().split('T')[0],
                        hora_inicio: `${hora.toString().padStart(2, '0')}:00`,
                        data_fim: dataHora.toISOString().split('T')[0],
                        hora_fim: `${(hora + 1).toString().padStart(2, '0')}:00`
                      });
                      setEventoDialogOpen(true);
                    }}
                  >
                    {eventosDaHora.map(evento => (
                      <div
                        key={evento.id}
                        className="text-xs p-1 mb-1 rounded truncate cursor-pointer"
                        style={{ backgroundColor: evento.cor, color: 'white' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setVisualizandoEvento(evento);
                        }}
                      >
                        {evento.titulo}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Renderizar visualização diária
  const renderVisaoDiaria = () => {
    const horas = Array.from({ length: 24 }, (_, i) => i);
    const eventosDoDia = eventosVisiveis;

    return (
      <div className="space-y-2">
        {horas.map(hora => {
          const eventosDaHora = eventosDoDia.filter(e => {
            const dataEvento = new Date(e.data_inicio);
            return dataEvento.getHours() === hora;
          });

          return (
            <div key={hora} className="flex gap-4 border-b pb-2">
              <div className="w-20 text-right text-sm text-slate-500 pt-2">
                {hora.toString().padStart(2, '0')}:00
              </div>
              <div className="flex-1 min-h-16 bg-slate-50 rounded-lg p-2 hover:bg-slate-100 cursor-pointer"
                onClick={() => {
                  const dataHora = new Date(dataAtual);
                  dataHora.setHours(hora, 0, 0, 0);
                  setEventoForm({
                    ...eventoForm,
                    data_inicio: dataHora.toISOString().split('T')[0],
                    hora_inicio: `${hora.toString().padStart(2, '0')}:00`,
                    data_fim: dataHora.toISOString().split('T')[0],
                    hora_fim: `${(hora + 1).toString().padStart(2, '0')}:00`
                  });
                  setEventoDialogOpen(true);
                }}
              >
                {eventosDaHora.map(evento => (
                  <div
                    key={evento.id}
                    className="p-3 mb-2 rounded-lg cursor-pointer hover:opacity-90"
                    style={{ backgroundColor: evento.cor, color: 'white' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setVisualizandoEvento(evento);
                    }}
                  >
                    <div className="font-semibold">{evento.titulo}</div>
                    {evento.cliente_nome && (
                      <div className="text-sm opacity-90">{evento.cliente_nome}</div>
                    )}
                    {evento.local && (
                      <div className="text-sm opacity-90 flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {evento.local}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const getTituloCalendario = () => {
    const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                   'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

    if (visualizacao === 'mes') {
      return `${meses[dataAtual.getMonth()]} ${dataAtual.getFullYear()}`;
    } else if (visualizacao === 'semana') {
      const inicioDaSemana = new Date(dataAtual);
      inicioDaSemana.setDate(dataAtual.getDate() - dataAtual.getDay());
      const fimDaSemana = new Date(inicioDaSemana);
      fimDaSemana.setDate(inicioDaSemana.getDate() + 6);

      return `${inicioDaSemana.getDate()} - ${fimDaSemana.getDate()} de ${meses[dataAtual.getMonth()]} ${dataAtual.getFullYear()}`;
    } else { // visualizacao === 'dia'
      return `${dataAtual.getDate()} de ${meses[dataAtual.getMonth()]} ${dataAtual.getFullYear()}`;
    }
  };

  // KPIs
  const eventosHoje = eventos.filter(e => {
    const hoje = new Date();
    const dataEvento = new Date(e.data_inicio);
    return dataEvento.toDateString() === hoje.toDateString();
  }).length;

  const eventosProximaSemana = eventos.filter(e => {
    const hoje = new Date();
    const proximaSemana = new Date(hoje.getTime() + 7 * 24 * 60 * 60 * 1000);
    const dataEvento = new Date(e.data_inicio);
    return dataEvento >= hoje && dataEvento <= proximaSemana;
  }).length;

  const eventosPendentes = eventos.filter(e =>
    e.status === 'Agendado' || e.status === 'Confirmado'
  ).length;

  const statusColors = {
    'Agendado': 'bg-blue-100 text-blue-700',
    'Confirmado': 'bg-green-100 text-green-700',
    'Em Andamento': 'bg-yellow-100 text-yellow-700',
    'Concluído': 'bg-gray-100 text-gray-700',
    'Cancelado': 'bg-red-100 text-red-700',
    'Adiado': 'bg-orange-100 text-orange-700'
  };

  const prioridadeColors = {
    'Baixa': 'bg-gray-100 text-gray-700',
    'Normal': 'bg-blue-100 text-blue-700',
    'Alta': 'bg-orange-100 text-orange-700',
    'Urgente': 'bg-red-100 text-red-700'
  };

  const coresDisponiveis = [
    { cor: '#3b82f6', nome: 'Azul' },
    { cor: '#10b981', nome: 'Verde' },
    { cor: '#f59e0b', nome: 'Laranja' },
    { cor: '#ef4444', nome: 'Vermelho' },
    { cor: '#8b5cf6', nome: 'Roxo' },
    { cor: '#ec4899', nome: 'Rosa' },
    { cor: '#06b6d4', nome: 'Ciano' },
    { cor: '#64748b', nome: 'Cinza' }
  ];

  const googleSyncAtivo = configuracoes?.integracao_maps?.ativa || false;


  return (
    <ProtectedSection module="Agenda" action="visualizar">
    <div className="w-full h-full flex flex-col overflow-hidden">
      <div className="flex-1 p-6 lg:p-8 space-y-6 overflow-auto">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Agenda e Calendário</h1>
        <p className="text-slate-600">Gerencie compromissos, reuniões e lembretes com notificações automáticas</p>
      </div>

      {/* Alert Sincronização */}
      {googleSyncAtivo ? (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <div>
                  <p className="font-semibold text-green-900">Google Calendar Sincronizado</p>
                  <p className="text-sm text-green-700">
                    Última sincronização: {new Date().toLocaleString('pt-BR')}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => sincronizarGoogleMutation.mutate()}
                disabled={sincronizarGoogleMutation.isPending}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${sincronizarGoogleMutation.isPending ? 'animate-spin' : ''}`} />
                Sincronizar Agora
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Info className="w-5 h-5 text-blue-600" />
                <div>
                  <p className="font-semibold text-blue-900">Sincronização com Google Calendar</p>
                  <p className="text-sm text-blue-700">
                    Configure a integração para sincronizar automaticamente seus eventos
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSyncGoogleDialogOpen(true)}
              >
                <Link2 className="w-4 h-4 mr-2" />
                Configurar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="border-0 shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Hoje</CardTitle>
            <Calendar className="w-5 h-5 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{eventosHoje}</div>
            <p className="text-xs text-slate-500 mt-1">compromissos</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Próxima Semana</CardTitle>
            <Clock className="w-5 h-5 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{eventosProximaSemana}</div>
            <p className="text-xs text-slate-500 mt-1">agendados</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Pendentes</CardTitle>
            <Bell className="w-5 h-5 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-600">{eventosPendentes}</div>
            <p className="text-xs text-slate-500 mt-1">a confirmar</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Total</CardTitle>
            <Users className="w-5 h-5 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-600">{eventos.length}</div>
            <p className="text-xs text-slate-500 mt-1">eventos cadastrados</p>
          </CardContent>
        </Card>
      </div>

      {/* Calendário */}
      <ErrorBoundary>
      <Card className="border-0 shadow-md">
        <CardHeader className="border-b bg-slate-50">
          <div className="flex flex-col sm:flex-row justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={navegarAnterior}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button variant="outline" onClick={irParaHoje}>
                  Hoje
                </Button>
                <Button variant="outline" size="icon" onClick={navegarProximo}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
              <h2 className="text-xl font-semibold">{getTituloCalendario()}</h2>
            </div>

            <div className="flex items-center gap-3">
              <Select value={filtroUsuario} onValueChange={setFiltroUsuario}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Filtrar por usuário" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {[...new Set(eventos.map(e => e.responsavel))].filter(Boolean).map(resp => (
                    <SelectItem key={resp} value={resp}>{resp}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex gap-2">
                <Button
                  variant={visualizacao === 'mes' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setVisualizacao('mes')}
                >
                  Mês
                </Button>
                <Button
                  variant={visualizacao === 'semana' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setVisualizacao('semana')}
                >
                  Semana
                </Button>
                <Button
                  variant={visualizacao === 'dia' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setVisualizacao('dia')}
                >
                  Dia
                </Button>
              </div>

              <Button 
                className="bg-blue-600 hover:bg-blue-700"
                onClick={() => openWindow(EventoForm, {
                  windowMode: true,
                  onSubmit: async (data) => {
                    try {
                      const dataInicio = `${data.data_inicio}T${data.hora_inicio || '00:00'}:00`;
                      const dataFim = `${data.data_fim}T${data.hora_fim || '23:59'}:00`;
                      await base44.entities.Evento.create(carimbarContexto({
                       ...data,
                       data_inicio: dataInicio,
                       data_fim: dataFim,
                       responsavel: user?.full_name || 'Usuário',
                       responsavel_id: user?.id
                      }));
                      queryClient.invalidateQueries({ queryKey: ['eventos'] });
                      toast({ title: "✅ Evento criado!" });
                    } catch (error) {
                      toast({ title: "❌ Erro", description: error.message, variant: "destructive" });
                    }
                  }
                }, {
                  title: '📅 Novo Evento',
                  width: 1000,
                  height: 650
                })}
              >
                <Plus className="w-4 h-4 mr-2" />
                Novo Evento
              </Button>
              
              {/* BACKUP: Dialog removido */}
              <Dialog open={false}>
                <DialogTrigger asChild>
                  <Button className="hidden">Removido</Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>{editingEvento ? 'Editar Evento' : 'Novo Evento'}</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2">
                        <Label htmlFor="titulo">Título *</Label>
                        <Input
                          id="titulo"
                          value={eventoForm.titulo}
                          onChange={(e) => setEventoForm({ ...eventoForm, titulo: e.target.value })}
                          required
                        />
                      </div>

                      <div>
                        <Label htmlFor="tipo">Tipo</Label>
                        <Select
                          value={eventoForm.tipo}
                          onValueChange={(value) => setEventoForm({ ...eventoForm, tipo: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Reunião">Reunião</SelectItem>
                            <SelectItem value="Ligação">Ligação</SelectItem>
                            <SelectItem value="Visita">Visita</SelectItem>
                            <SelectItem value="Tarefa">Tarefa</SelectItem>
                            <SelectItem value="Follow-up">Follow-up</SelectItem>
                            <SelectItem value="Evento">Evento</SelectItem>
                            <SelectItem value="Lembrete">Lembrete</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label htmlFor="prioridade">Prioridade</Label>
                        <Select
                          value={eventoForm.prioridade}
                          onValueChange={(value) => setEventoForm({ ...eventoForm, prioridade: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Baixa">Baixa</SelectItem>
                            <SelectItem value="Normal">Normal</SelectItem>
                            <SelectItem value="Alta">Alta</SelectItem>
                            <SelectItem value="Urgente">Urgente</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label htmlFor="data_inicio">Data Início *</Label>
                        <Input
                          id="data_inicio"
                          type="date"
                          value={eventoForm.data_inicio}
                          onChange={(e) => setEventoForm({ ...eventoForm, data_inicio: e.target.value })}
                          required
                        />
                      </div>

                      <div>
                        <Label htmlFor="hora_inicio">Hora Início</Label>
                        <Input
                          id="hora_inicio"
                          type="time"
                          value={eventoForm.hora_inicio}
                          onChange={(e) => setEventoForm({ ...eventoForm, hora_inicio: e.target.value })}
                          disabled={eventoForm.dia_inteiro}
                        />
                      </div>

                      <div>
                        <Label htmlFor="data_fim">Data Fim *</Label>
                        <Input
                          id="data_fim"
                          type="date"
                          value={eventoForm.data_fim}
                          onChange={(e) => setEventoForm({ ...eventoForm, data_fim: e.target.value })}
                          required
                        />
                      </div>

                      <div>
                        <Label htmlFor="hora_fim">Hora Fim</Label>
                        <Input
                          id="hora_fim"
                          type="time"
                          value={eventoForm.hora_fim}
                          onChange={(e) => setEventoForm({ ...eventoForm, hora_fim: e.target.value })}
                          disabled={eventoForm.dia_inteiro}
                        />
                      </div>

                      <div className="col-span-2">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="dia_inteiro"
                            checked={eventoForm.dia_inteiro}
                            onCheckedChange={(checked) => setEventoForm({ ...eventoForm, dia_inteiro: checked })}
                          />
                          <Label htmlFor="dia_inteiro" className="font-normal cursor-pointer">
                            Dia inteiro
                          </Label>
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="cliente_nome">Cliente/Relacionado</Label>
                        <Input
                          id="cliente_nome"
                          value={eventoForm.cliente_nome}
                          onChange={(e) => setEventoForm({ ...eventoForm, cliente_nome: e.target.value })}
                          list="clientes-list"
                        />
                        <datalist id="clientes-list">
                          {clientes.map(c => (
                            <option key={c.id} value={c.nome} />
                          ))}
                        </datalist>
                      </div>

                      <div>
                        <Label htmlFor="pedido_id">Pedido Relacionado</Label>
                        <Select
                          value={eventoForm.pedido_id}
                          onValueChange={(value) => setEventoForm({ ...eventoForm, pedido_id: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={null}>Nenhum</SelectItem>
                            {pedidos.slice(0, 20).map(p => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.numero_pedido} - {p.cliente_nome}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label htmlFor="local">Local</Label>
                        <Input
                          id="local"
                          value={eventoForm.local}
                          onChange={(e) => setEventoForm({ ...eventoForm, local: e.target.value })}
                          placeholder="Endereço ou sala"
                        />
                      </div>

                      <div className="col-span-2">
                        <Label htmlFor="link_reuniao">Link da Reunião</Label>
                        <Input
                          id="link_reuniao"
                          value={eventoForm.link_reuniao}
                          onChange={(e) => setEventoForm({ ...eventoForm, link_reuniao: e.target.value })}
                          placeholder="https://meet.google.com/..."
                        />
                      </div>

                      <div>
                        <Label htmlFor="status">Status</Label>
                        <Select
                          value={eventoForm.status}
                          onValueChange={(value) => setEventoForm({ ...eventoForm, status: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Agendado">Agendado</SelectItem>
                            <SelectItem value="Confirmado">Confirmado</SelectItem>
                            <SelectItem value="Em Andamento">Em Andamento</SelectItem>
                            <SelectItem value="Concluído">Concluído</SelectItem>
                            <SelectItem value="Cancelado">Cancelado</SelectItem>
                            <SelectItem value="Adiado">Adiado</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label htmlFor="cor">Cor no Calendário</Label>
                        <div className="flex gap-2 mt-2">
                          {coresDisponiveis.map(({ cor, nome }) => (
                            <button
                              key={cor}
                              type="button"
                              className={`w-8 h-8 rounded-full border-2 ${
                                eventoForm.cor === cor ? 'border-slate-900' : 'border-transparent'
                              }`}
                              style={{ backgroundColor: cor }}
                              onClick={() => setEventoForm({ ...eventoForm, cor })}
                              title={nome}
                            />
                          ))}
                        </div>
                      </div>

                      <div className="col-span-2 space-y-3 border-t pt-4">
                        <h4 className="font-semibold text-sm">Lembretes e Notificações</h4>

                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="lembrete"
                            checked={eventoForm.lembrete}
                            onCheckedChange={(checked) => setEventoForm({ ...eventoForm, lembrete: checked })}
                          />
                          <Label htmlFor="lembrete" className="font-normal cursor-pointer">
                            Ativar lembrete automático
                          </Label>
                        </div>

                        {eventoForm.lembrete && (
                          <div>
                            <Label htmlFor="tempo_lembrete">Lembrar com (minutos de antecedência)</Label>
                            <Input
                              id="tempo_lembrete"
                              type="number"
                              value={eventoForm.tempo_lembrete}
                              onChange={(e) => setEventoForm({ ...eventoForm, tempo_lembrete: parseInt(e.target.value) })}
                              min="0"
                            />
                          </div>
                        )}

                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="notificar_email"
                            checked={eventoForm.notificar_email}
                            onCheckedChange={(checked) => setEventoForm({ ...eventoForm, notificar_email: checked })}
                          />
                          <Label htmlFor="notificar_email" className="font-normal cursor-pointer flex items-center gap-2">
                            <Mail className="w-4 h-4" />
                            Enviar lembrete por e-mail
                          </Label>
                        </div>

                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="notificar_whatsapp"
                            checked={eventoForm.notificar_whatsapp}
                            onCheckedChange={(checked) => setEventoForm({ ...eventoForm, notificar_whatsapp: checked })}
                          />
                          <Label htmlFor="notificar_whatsapp" className="font-normal cursor-pointer flex items-center gap-2">
                            <MessageSquare className="w-4 h-4" />
                            Enviar lembrete por WhatsApp
                          </Label>
                        </div>
                      </div>

                      <div className="col-span-2">
                        <Label htmlFor="descricao">Descrição</Label>
                        <Textarea
                          id="descricao"
                          value={eventoForm.descricao}
                          onChange={(e) => setEventoForm({ ...eventoForm, descricao: e.target.value })}
                          rows={3}
                        />
                      </div>

                      <div className="col-span-2">
                        <Label htmlFor="observacoes">Observações</Label>
                        <Textarea
                          id="observacoes"
                          value={eventoForm.observacoes}
                          onChange={(e) => setEventoForm({ ...eventoForm, observacoes: e.target.value })}
                          rows={2}
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                      <Button
                        type="submit"
                        disabled={createEventoMutation.isPending || updateEventoMutation.isPending}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        {createEventoMutation.isPending || updateEventoMutation.isPending
                          ? 'Salvando...'
                          : editingEvento
                          ? 'Atualizar'
                          : 'Criar Evento'}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-6">
          {visualizacao === 'mes' && renderCalendarioMensal()}
          {visualizacao === 'semana' && renderVisaoSemanal()}
          {visualizacao === 'dia' && renderVisaoDiaria()}
        </CardContent>
      </Card>
      </ErrorBoundary>

      {/* Dialog de Visualização do Evento */}
      <Dialog open={!!visualizandoEvento} onOpenChange={() => setVisualizandoEvento(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalhes do Evento</DialogTitle>
          </DialogHeader>
          {visualizandoEvento && (
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-2xl font-bold mb-2">{visualizandoEvento.titulo}</h3>
                  <div className="flex gap-2">
                    <Badge className={statusColors[visualizandoEvento.status]}>
                      {visualizandoEvento.status}
                    </Badge>
                    <Badge className={prioridadeColors[visualizandoEvento.prioridade]}>
                      {visualizandoEvento.prioridade}
                    </Badge>
                    <Badge variant="outline">{visualizandoEvento.tipo}</Badge>
                  </div>
                </div>
                <div
                  className="w-12 h-12 rounded-full"
                  style={{ backgroundColor: visualizandoEvento.cor }}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-slate-500">Data/Hora Início</p>
                  <p className="font-semibold">
                    {new Date(visualizandoEvento.data_inicio).toLocaleString('pt-BR')}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Data/Hora Fim</p>
                  <p className="font-semibold">
                    {new Date(visualizandoEvento.data_fim).toLocaleString('pt-BR')}
                  </p>
                </div>
              </div>

              {visualizandoEvento.descricao && (
                <div>
                  <p className="text-sm text-slate-500 mb-1">Descrição</p>
                  <p className="text-sm">{visualizandoEvento.descricao}</p>
                </div>
              )}

              {visualizandoEvento.cliente_nome && (
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-slate-500" />
                  <span className="font-semibold">{visualizandoEvento.cliente_nome}</span>
                </div>
              )}

              {visualizandoEvento.local && (
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-slate-500" />
                  <span>{visualizandoEvento.local}</span>
                </div>
              )}

              {visualizandoEvento.link_reuniao && (
                <div className="flex items-center gap-2">
                  <Video className="w-4 h-4 text-slate-500" />
                  <a
                    href={visualizandoEvento.link_reuniao}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    {visualizandoEvento.link_reuniao}
                  </a>
                </div>
              )}

              {visualizandoEvento.lembrete && (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Bell className="w-4 h-4" />
                  <span>Lembrete: {visualizandoEvento.tempo_lembrete} minutos antes</span>
                </div>
              )}

              {visualizandoEvento.observacoes && (
                <div>
                  <p className="text-sm text-slate-500 mb-1">Observações</p>
                  <p className="text-sm">{visualizandoEvento.observacoes}</p>
                </div>
              )}

              <div className="flex justify-between items-center pt-4 border-t">
                <div className="text-sm text-slate-500">
                  Criado por: {visualizandoEvento.responsavel}
                </div>
                <div className="flex gap-2">
                  {visualizandoEvento.status !== 'Concluído' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleConcluir(visualizandoEvento)}
                      className="text-green-600 hover:text-green-700"
                    >
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Concluir
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setVisualizandoEvento(null);
                      openWindow(EventoForm, {
                        evento: visualizandoEvento,
                        windowMode: true,
                        onSubmit: async (data) => {
                          try {
                            const dataInicio = `${data.data_inicio}T${data.hora_inicio || '00:00'}:00`;
                            const dataFim = `${data.data_fim}T${data.hora_fim || '23:59'}:00`;
                            await base44.entities.Evento.update(visualizandoEvento.id, {
                              ...data,
                              data_inicio: dataInicio,
                              data_fim: dataFim
                            });
                            queryClient.invalidateQueries({ queryKey: ['eventos'] });
                            toast({ title: "✅ Evento atualizado!" });
                          } catch (error) {
                            toast({ title: "❌ Erro", description: error.message, variant: "destructive" });
                          }
                        }
                      }, {
                        title: `✏️ Editar: ${visualizandoEvento.titulo}`,
                        width: 1000,
                        height: 650
                      });
                    }}
                  >
                    <Edit className="w-4 h-4 mr-1" />
                    Editar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(visualizandoEvento)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Excluir
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog Sync Google */}
      <Dialog open={syncGoogleDialogOpen} onOpenChange={setSyncGoogleDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Sincronizar com Google Calendar</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 rounded border border-blue-200">
              <Info className="w-5 h-5 text-blue-600 mb-2" />
              <p className="text-sm text-blue-900">
                <strong>Modo Simulado:</strong> Esta é uma demonstração da funcionalidade.
                Na produção, você precisará configurar as credenciais OAuth do Google Calendar.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-2">O que será sincronizado:</h4>
              <ul className="text-sm text-slate-600 space-y-1">
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  Eventos do Google Calendar → Agenda ERP
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  Eventos da Agenda ERP → Google Calendar
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  Atualização bidirecional em tempo real
                </li>
              </ul>
            </div>

            <div className="flex gap-3 justify-end pt-4">
              <Button variant="outline" onClick={() => setSyncGoogleDialogOpen(false)}>
                Cancelar
              </Button>
              <Button
                onClick={() => sincronizarGoogleMutation.mutate()}
                disabled={sincronizarGoogleMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {sincronizarGoogleMutation.isPending ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Sincronizando...
                  </>
                ) : (
                  <>
                    <Link2 className="w-4 h-4 mr-2" />
                    Iniciar Sincronização
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      </div>
    </div>
    </ProtectedSection>
  );
}
export default React.memo(Agenda);
