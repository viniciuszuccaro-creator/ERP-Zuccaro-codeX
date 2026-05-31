import React from "react";
import ChatbotIntentForm from "./ChatbotIntentForm";
import { base44 } from "@/api/base44Client";
import { useContextoVisual } from "@/components/lib/useContextoVisual";
import usePermissions from "@/components/lib/usePermissions";

const sanitizeText = (value, max = 500) => String(value ?? "").replace(/[<>]/g, "").slice(0, max).trim();

const sanitizeList = (items = []) => items
  .map((item) => sanitizeText(item, 160))
  .filter(Boolean);

// Adapter: mantem a API antiga mas grava/edita na entidade consolidada ChatbotIntent.
export default function ChatbotIntentsForm({ intent, onSubmit, isSubmitting }) {
  const { empresaAtual, grupoAtual, contexto, filterInContext, createInContext, updateInContext } = useContextoVisual();
  const { canCreate, canEdit } = usePermissions();
  const groupId = grupoAtual?.id || empresaAtual?.group_id || empresaAtual?.grupo_id || intent?.group_id || null;
  const empresaId = contexto === "empresa" ? empresaAtual?.id : intent?.empresa_id || null;
  const contextoValido = Boolean(groupId || empresaId);
  const podeCriar = canCreate("Cadastros", "ChatbotIntent") || canCreate("Sistema", "ChatbotIntent") || canCreate("Cadastros", null);
  const podeEditar = canEdit("Cadastros", "ChatbotIntent") || canEdit("Sistema", "ChatbotIntent") || canEdit("Cadastros", null);
  const podeSalvar = intent?.id ? podeEditar : podeCriar;

  const toNew = (legacy) => {
    const prioridadeMap = { Baixa: 25, Normal: 50, Alta: 75, Urgente: 100 };
    return {
      id: legacy?.__entity === "ChatbotIntent" ? legacy?.id : undefined,
      group_id: legacy?.group_id || groupId || undefined,
      grupo_id: legacy?.grupo_id || legacy?.group_id || groupId || undefined,
      empresa_id: legacy?.empresa_id || empresaId || undefined,
      nome_intent: legacy?.nome_intent || "",
      descricao: legacy?.descricao || "",
      frases_treinamento: legacy?.frases_treinamento || [],
      palavras_chave: legacy?.palavras_chave || [],
      tipo_intent: legacy?.tipo_intent || "consulta",
      acao_automatica: legacy?.acao_automatica || "nenhuma",
      entidade_vinculada: legacy?.entidade_vinculada || "",
      exige_autenticacao: !!legacy?.requer_autenticacao || !!legacy?.exige_autenticacao,
      resposta_template: legacy?.resposta_padrao || legacy?.resposta_template || "",
      prioridade: prioridadeMap[legacy?.prioridade] ?? legacy?.prioridade ?? 100,
      ativo: legacy?.ativo ?? true,
      observacoes: legacy?.observacoes || "",
    };
  };

  const toLegacy = (neo) => ({
    nome_intent: neo?.nome_intent,
    descricao: neo?.descricao,
    palavras_chave: neo?.palavras_chave || [],
    tipo_intent: neo?.tipo_intent,
    entidade_vinculada: neo?.entidade_vinculada,
    requer_autenticacao: !!neo?.exige_autenticacao,
    resposta_padrao: neo?.resposta_template,
    prioridade: neo?.prioridade,
    ativo: neo?.ativo,
    observacoes: neo?.observacoes,
  });

  const normalizar = (data) => ({
    ...data,
    nome: sanitizeText(data?.nome || data?.nome_intent, 180),
    nome_intent: sanitizeText(data?.nome_intent || data?.nome, 180),
    descricao: sanitizeText(data?.descricao, 500),
    origem_dados: sanitizeText(data?.origem_dados, 180),
    entidade_vinculada: sanitizeText(data?.entidade_vinculada, 180),
    resposta_template: sanitizeText(data?.resposta_template, 2000),
    observacoes: sanitizeText(data?.observacoes, 1000),
    frases_treinamento: sanitizeList(data?.frases_treinamento || []),
    palavras_chave: sanitizeList(data?.palavras_chave || []),
    group_id: data?.group_id || groupId,
    grupo_id: data?.grupo_id || data?.group_id || groupId,
    empresa_id: contexto === "empresa" ? empresaAtual?.id : data?.empresa_id || empresaId,
  });

  const auditIntent = async ({ acao, sucesso = true, motivo = null, dados = {} }) => {
    try {
      await base44.entities.AuditLog.create({
        acao,
        modulo: "Cadastros",
        entidade: "ChatbotIntent",
        registro_id: dados.registro_id || intent?.id || null,
        empresa_id: dados.empresa_id || empresaId || null,
        group_id: dados.group_id || groupId || null,
        grupo_id: dados.group_id || groupId || null,
        tipo_auditoria: sucesso ? "entidade" : "seguranca",
        descricao: motivo || "Auditoria de intent do chatbot.",
        dados_anteriores: dados.dados_anteriores || null,
        dados_novos: { ...dados, contexto },
        sucesso,
        data_hora: new Date().toISOString(),
      });
    } catch (_) {}
  };

  const initial = toNew(intent);

  const handleSubmit = async (data) => {
    if (!contextoValido) {
      await auditIntent({ acao: "ChatbotIntent.salvar_bloqueado", sucesso: false, motivo: "Contexto de grupo ou empresa obrigatorio.", dados: { nome_intent: data?.nome_intent } });
      alert("Selecione um grupo ou empresa antes de salvar intents do chatbot.");
      return;
    }
    if (!podeSalvar) {
      await auditIntent({ acao: "ChatbotIntent.salvar_negado", sucesso: false, motivo: "Permissao negada para salvar intent do chatbot.", dados: { nome_intent: data?.nome_intent } });
      alert("Sem permissão para salvar intents do chatbot.");
      return;
    }

    const payload = normalizar(data);
    if (initial?.ativo !== false && payload.ativo === false) {
      const confirmado = window.confirm("Desativar esta intent do chatbot? A alteração será auditada e pode afetar atendimentos automáticos.");
      if (!confirmado) {
        await auditIntent({ acao: "ChatbotIntent.desativacao_cancelada", sucesso: false, motivo: "Confirmacao cancelada pelo usuario.", dados: { nome_intent: payload.nome_intent } });
        return;
      }
    }

    let registro;
    let acao = "ChatbotIntent.criado";
    const dadosAnteriores = intent ? { ...intent } : null;

    try {
      if (intent?.id && intent?.__entity === "ChatbotIntent") {
        registro = await updateInContext("ChatbotIntent", intent.id, payload);
        acao = "ChatbotIntent.editado";
      } else if (intent?.id && intent?.__entity === "ChatbotIntents") {
        const existentes = await filterInContext("ChatbotIntent", { nome_intent: intent.nome_intent }, undefined, 1);
        if (existentes?.length) {
          registro = await updateInContext("ChatbotIntent", existentes[0].id, payload);
          acao = "ChatbotIntent.migrado_editado";
        } else {
          registro = await createInContext("ChatbotIntent", payload);
          acao = "ChatbotIntent.migrado_criado";
        }
      } else {
        registro = await createInContext("ChatbotIntent", payload);
      }
    } catch (error) {
      await auditIntent({
        acao: "ChatbotIntent.erro_salvar",
        sucesso: false,
        motivo: error?.message || "Erro ao salvar intent do chatbot.",
        dados: { nome_intent: payload.nome_intent, dados_anteriores: dadosAnteriores },
      });
      alert(error?.message || "Erro ao salvar intent do chatbot.");
      return;
    }

    await auditIntent({
      acao,
      sucesso: true,
      dados: {
        registro_id: registro?.id || intent?.id || null,
        empresa_id: payload.empresa_id || registro?.empresa_id || null,
        group_id: payload.group_id || registro?.group_id || null,
        nome_intent: payload.nome_intent,
        ativo: payload.ativo,
        dados_anteriores: dadosAnteriores,
        dados_novos: registro || payload,
      },
    });

    if (typeof onSubmit === "function") onSubmit(toLegacy(registro || payload));
  };

  return <ChatbotIntentForm chatbotIntent={initial} onSubmit={handleSubmit} isSubmitting={isSubmitting} windowMode={false} />;
}
