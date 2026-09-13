import { useEffect, useState } from "react";

// Hook para padronizar paginação backend com persistência por entidade
// Uso: const { page, setPage, pageSize, setPageSize } = useBackendPagination('Pedido', 20)
export default function useBackendPagination(entityName, defaultPageSize = 20) {
  const storageKey = `pagination_${entityName}`;
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);

  // Restaurar do storage na carga
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const { page: p, pageSize: ps } = JSON.parse(raw);
        if (p) setPage(p);
        if (ps) setPageSize(ps);
      }
    } catch (error) {
      console.warn('[useBackendPagination] Preferencias de paginacao indisponiveis', error);
    }
  }, [entityName]);

  // Persistir quando mudar
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ page, pageSize }));
    } catch (error) {
      console.warn('[useBackendPagination] Falha ao persistir paginacao', error);
    }
  }, [storageKey, page, pageSize]);

  return { page, setPage, pageSize, setPageSize };
}
