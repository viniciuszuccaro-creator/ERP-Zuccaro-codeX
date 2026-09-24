import React from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

/**
 * Componente de controles de paginacao reutilizavel.
 * @param {{ currentPage?: number, totalItems?: number, itemsPerPage?: number, onPageChange: (page: number) => void, onItemsPerPageChange?: (size: number) => void, isLoading?: boolean }} props
 */
export default function PaginationControls({
  currentPage = 1,
  totalItems = 0,
  itemsPerPage = 50,
  onPageChange,
  onItemsPerPageChange,
  isLoading = false
}) {
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startItem = totalItems === 0 ? 0 : ((currentPage - 1) * itemsPerPage) + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  const canGoPrevious = currentPage > 1;
  const canGoNext = currentPage < totalPages;

  const handleFirstPage = () => {
    if (canGoPrevious && !isLoading) {
      onPageChange(1);
    }
  };

  const handlePreviousPage = () => {
    if (canGoPrevious && !isLoading) {
      onPageChange(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (canGoNext && !isLoading) {
      onPageChange(currentPage + 1);
    }
  };

  const handleLastPage = () => {
    if (canGoNext && !isLoading) {
      onPageChange(totalPages);
    }
  };

  const handleItemsPerPageChange = (value) => {
    if (!isLoading && onItemsPerPageChange) {
      onItemsPerPageChange(parseInt(value, 10));
      // Reset para página 1 ao mudar quantidade de itens
      onPageChange(1);
    }
  };

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 py-3 bg-white border-t border-slate-200">
      {/* Informação de paginação */}
      <div className="flex items-center gap-2 text-sm text-slate-600">
        <span className="hidden sm:inline">
          Mostrando <span className="font-semibold text-slate-900">{startItem}</span> a{' '}
          <span className="font-semibold text-slate-900">{endItem}</span> de{' '}
          <span className="font-semibold text-slate-900">{totalItems}</span> registros
        </span>
        <span className="sm:hidden">
          {startItem}-{endItem} de {totalItems}
        </span>
      </div>

      {/* Controles centrais */}
      <div className="flex items-center gap-2">
        {/* Seletor de itens por página */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-600 hidden sm:inline">Por página:</span>
          <Select
            value={itemsPerPage.toString()}
            onValueChange={handleItemsPerPageChange}
            disabled={isLoading}
          >
            <SelectTrigger className="w-20 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="20">20</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
              <SelectItem value="200">200</SelectItem>
              <SelectItem value="500">500</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Botões de navegação */}
        <div className="flex items-center gap-1 ml-4">
          <Button
            variant="outline"
            size="icon"
            onClick={handleFirstPage}
            disabled={!canGoPrevious || isLoading}
            className="h-9 w-9"
            title="Primeira página"
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={handlePreviousPage}
            disabled={!canGoPrevious || isLoading}
            className="h-9 w-9"
            title="Página anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          <div className="flex items-center gap-2 px-3">
            <span className="text-sm text-slate-600">
              Página <span className="font-semibold text-slate-900">{currentPage}</span> de{' '}
              <span className="font-semibold text-slate-900">{totalPages || 1}</span>
            </span>
          </div>

          <Button
            variant="outline"
            size="icon"
            onClick={handleNextPage}
            disabled={!canGoNext || isLoading}
            className="h-9 w-9"
            title="Próxima página"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={handleLastPage}
            disabled={!canGoNext || isLoading}
            className="h-9 w-9"
            title="Última página"
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
