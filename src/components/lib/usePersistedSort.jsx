import { useEffect, useState } from "react";

// Hook simples para padronizar e persistir sort por entidade (localStorage)
// Uso: const [sortField, setSortField, sortDirection, setSortDirection] = usePersistedSort('OrdemCompra', 'data_solicitacao', 'desc')
export default function usePersistedSort(entityName, defaultField = 'updated_date', defaultDirection = 'desc') {
  const [sortField, setSortField] = useState(defaultField);
  const [sortDirection, setSortDirection] = useState(defaultDirection);

  // Restaurar do storage na primeira carga
  useEffect(() => {
    try {
      const raw = localStorage.getItem(`sort_${entityName}`);
      if (raw) {
        const st = JSON.parse(raw);
        const sf = st?.sortField ?? st?.field;
        const sd = st?.sortDirection ?? st?.direction;
        if (sf) setSortField(sf);
        if (sd) setSortDirection(sd);
      }
    } catch (error) {
      console.warn('[usePersistedSort] Ordenacao persistida indisponivel', error);
    }
  }, [entityName]);

  // Persistir toda vez que mudar
  useEffect(() => {
    try {
      localStorage.setItem(`sort_${entityName}`, JSON.stringify({ sortField, sortDirection }));
    } catch (error) {
      console.warn('[usePersistedSort] Falha ao persistir ordenacao', error);
    }
  }, [entityName, sortField, sortDirection]);

  return [sortField, setSortField, sortDirection, setSortDirection];
}
