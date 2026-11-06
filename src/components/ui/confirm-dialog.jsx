import React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertTriangle, Trash2, CheckCircle } from 'lucide-react';

/**
 * Diálogo de Confirmação antes de Excluir
 * V12.0 - Previne exclusões acidentais
 * @param {{open: boolean, onOpenChange: (open: boolean) => void, onConfirm: React.MouseEventHandler<HTMLButtonElement>, title?: React.ReactNode, description?: React.ReactNode, variant?: string, confirmText?: React.ReactNode, cancelText?: React.ReactNode}} props
 */
export default function ConfirmDialog({ 
  open, 
  onOpenChange, 
  onConfirm,
  title = "Tem certeza?",
  description,
  variant = "danger",
  confirmText = "Confirmar",
  cancelText = "Cancelar"
}) {
  const variants = {
    danger: {
      icon: <Trash2 className="w-6 h-6 text-red-600" />,
      buttonClass: "bg-red-600 hover:bg-red-700"
    },
    warning: {
      icon: <AlertTriangle className="w-6 h-6 text-orange-600" />,
      buttonClass: "bg-orange-600 hover:bg-orange-700"
    },
    success: {
      icon: <CheckCircle className="w-6 h-6 text-green-600" />,
      buttonClass: "bg-green-600 hover:bg-green-700"
    }
  };

  const config = variants[variant] || variants.danger;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            {config.icon}
            <AlertDialogTitle className="text-xl">{title}</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-base">
            {description || "Esta ação não pode ser desfeita. Deseja continuar?"}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{cancelText}</AlertDialogCancel>
          <AlertDialogAction 
            onClick={onConfirm}
            className={config.buttonClass}
          >
            {confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// Hook para usar facilmente
export function useConfirm() {
  const [isOpen, setIsOpen] = React.useState(false);
  const [config, setConfig] = React.useState({});
  /** @type {React.MutableRefObject<((value: boolean) => void) | undefined>} */
  const resolveRef = React.useRef();

  /** @param {Partial<React.ComponentProps<typeof ConfirmDialog>>} options
   * @returns {Promise<boolean>} */
  const confirm = (options) => {
    return new Promise((resolve) => {
      setConfig(options);
      setIsOpen(true);
      resolveRef.current = resolve;
    });
  };

  const handleConfirm = () => {
    resolveRef.current?.(true);
    setIsOpen(false);
  };

  const handleCancel = () => {
    resolveRef.current?.(false);
    setIsOpen(false);
  };

  const ConfirmDialogComponent = () => (
    <ConfirmDialog
      open={isOpen}
      onOpenChange={setIsOpen}
      onConfirm={handleConfirm}
      {...config}
    />
  );

  return { confirm, ConfirmDialog: ConfirmDialogComponent };
}
