import React, { useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useContextoVisual } from "@/components/lib/useContextoVisual";

/**
 * GlobalContextStamp
 * - Carimba automaticamente group_id/empresa_id em create/update/bulkCreate quando ausentes
 * - Injeta filtro de contexto em filter() quando não informado
 * - Nunca lanca erro no patch: sessao/auth e entidades de sistema nao podem quebrar o boot
 * - Nao altera UI e nao renderiza nada
 */

const SKIP_ENTITY_PATCH = new Set([
  'User',
  'SessaoUsuario',
  'AuditLog',
  'PerfilAcesso',
  'GrupoEmpresarial',
]);

const safeCarimbar = (carimbarContexto, dados) => {
  if (typeof carimbarContexto !== 'function') return dados;
  try {
    return carimbarContexto(dados) || dados;
  } catch (error) {
    console.warn('[GlobalContextStamp] Contexto indisponivel; gravacao sem carimbo automatico.', error?.message || error);
    return dados;
  }
};

export default function GlobalContextStamp() {
  const { getFiltroContexto, carimbarContexto, contextoValido } = useContextoVisual();
  const contextRef = React.useRef({ getFiltroContexto, carimbarContexto, contextoValido });

  contextRef.current = { getFiltroContexto, carimbarContexto, contextoValido };

  useEffect(() => {
    if (!base44?.entities) return;
    const root = base44.entities;
    if (root.__patched_multiempresa_v2) return;

    const patchEntity = (name) => {
      if (SKIP_ENTITY_PATCH.has(name)) return;
      const api = root[name];
      if (!api || typeof api !== 'object') return;

      const o = {
        create: api.create?.bind(api),
        bulkCreate: api.bulkCreate?.bind(api),
        update: api.update?.bind(api),
        filter: api.filter?.bind(api),
        list: api.list?.bind(api),
      };

      if (o.create) {
        api.create = (dados) => o.create(safeCarimbar(contextRef.current.carimbarContexto, dados));
      }

      if (o.bulkCreate) {
        api.bulkCreate = (lista) => o.bulkCreate(
          (lista || []).map((item) => safeCarimbar(contextRef.current.carimbarContexto, item)),
        );
      }

      if (o.update) {
        api.update = (id, dados) => o.update(id, safeCarimbar(contextRef.current.carimbarContexto, dados));
      }

      if (o.filter) {
        api.filter = (criterios = {}, order, limit) => {
          const ctx = contextRef.current.contextoValido
            ? (contextRef.current.getFiltroContexto?.() || {})
            : {};
          const merged = { ...criterios, ...ctx };
          return o.filter(merged, order, limit);
        };
      }

      if (o.list) {
        api.list = (order, limit) => {
          const ctx = contextRef.current.contextoValido
            ? (contextRef.current.getFiltroContexto?.() || {})
            : {};
          if (o.filter && ctx && (ctx.group_id || ctx.empresa_id)) {
            return o.filter(ctx, order, limit);
          }
          return o.list(order, limit);
        };
      }
    };

    try {
      Object.keys(root).forEach((key) => patchEntity(key));
      root.__patched_multiempresa_v2 = true;
      root.__patched_multiempresa = true;
    } catch (error) {
      console.warn('[GlobalContextStamp] Falha ao aplicar patch multiempresa.', error);
    }
  }, []);

  return null;
}
