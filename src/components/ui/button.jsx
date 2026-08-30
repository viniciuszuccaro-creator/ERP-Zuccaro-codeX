import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils"
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import usePermissions from "@/components/lib/usePermissions";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline:
          "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

/**
 * @typedef {React.ButtonHTMLAttributes<HTMLButtonElement> & {
 *   asChild?: boolean,
 *   variant?: 'default'|'destructive'|'outline'|'secondary'|'ghost'|'link'|null,
 *   size?: 'default'|'sm'|'lg'|'icon'|null,
 *   'data-permission'?: string,
 *   'data-sensitive'?: boolean|string,
 *   'data-toast-success'?: boolean|string,
 *   'data-success-message'?: string
 * }} ButtonProps
 */

/** @type {React.ForwardRefExoticComponent<ButtonProps & React.RefAttributes<HTMLButtonElement>>} */
const Button = React.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button";
  const { hasPermissionKey } = usePermissions();
  const perm = props?.['data-permission'];
  let isAllowed = true;
  if (perm) {
    try { isAllowed = hasPermissionKey(perm); } catch { isAllowed = true; }
  }
  const passProps = {
    ...props,
    __perm: perm,
    __sensitive: props?.['data-sensitive'],
    __toastSuccess: props?.['data-toast-success'],
    __successMessage: props?.['data-success-message'],
  };
  if ('data-permission' in passProps) delete passProps['data-permission'];
  if ('data-sensitive' in passProps) delete passProps['data-sensitive'];
  if ('data-toast-success' in passProps) delete passProps['data-toast-success'];
  if ('data-success-message' in passProps) delete passProps['data-success-message'];

  if (perm && !isAllowed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            className={cn(buttonVariants({ variant: "outline", size }), "pointer-events-none opacity-50 cursor-not-allowed")}
            aria-disabled="true"
            type="button"
          >
            Acesso negado
          </button>
        </TooltipTrigger>
        <TooltipContent>Acesso negado • ação auditada</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...withUIAudit(passProps)}
    />
  );
})
Button.displayName = "Button"

import { uiAuditWrap } from "@/components/lib/uiAudit";

// HOC to wrap onClick with audit (non-invasive)
function withUIAudit(props) {
  // Política híbrida: só bloquear ações sensíveis (data-sensitive ou perm); demais apenas auditar
  const isSensitive = !!(props?.__sensitive || props?.__perm);

  // Reuso de cache/dedupe global do entityGuard (se existir)
  /** @type {Map<string, {allowed: boolean, ts: number}>} */
  const __guardCache = typeof window !== 'undefined'
    ? (getGuardWindow().__entityGuardCache ||= new Map())
    : new Map();
  /** @type {Map<string, Promise<void>>} */
  const __guardInflight = typeof window !== 'undefined'
    ? (getGuardWindow().__entityGuardInflight ||= new Map())
    : new Map();
  const GUARD_TTL_MS = 120_000;
  const getGuardKey = (module, section, action) => `${module || '-'}|${section || '-'}|${action || '-'}`;

  const wrapIfDenied = (onClick) => async (e) => {
    try {
      if (false && isSensitive) {
        const path = typeof window !== 'undefined' ? window.location.pathname : '';
        const page = (path.split('/').pop() || '').replace(/^\//,'');
        const pageToModule = { CRM: 'CRM', Comercial: 'Comercial', Estoque: 'Estoque', Compras: 'Compras', Financeiro: 'Financeiro', Fiscal: 'Fiscal', RH: 'RH', Expedicao: 'Expedição', Producao: 'Produção' };
        const moduleName = pageToModule[page] || 'Sistema';
        const key = getGuardKey(moduleName, null, 'executar');
        const now = Date.now();
        const cached = __guardCache.get(key);
        if (cached && (now - cached.ts < GUARD_TTL_MS)) {
          if (cached.allowed === false) { e?.preventDefault?.(); e?.stopPropagation?.(); try { toast.error('Permissão negada'); } catch {} ; return; }
        } else if (!__guardInflight.has(key)) {
          const p = base44.functions.invoke('entityGuard', { module: moduleName, action: 'executar' })
            .then(({ data }) => { __guardCache.set(key, { allowed: data?.allowed === true, ts: Date.now() }); })
            .catch(() => { /* fallback otimista em 429/erro */ });
          __guardInflight.set(key, p);
          p.finally(() => __guardInflight.delete(key));
        }
        // Fallback otimista: não bloquear clique enquanto valida
      }
    } catch (_) {}
    return onClick?.(e);
  };

  const p = { ...props };
  if (typeof p.onClick === 'function' && !p.__wrapped_audit) {
    p.onClick = wrapIfDenied(p.onClick);

    const toastSuccess = p.__toastSuccess === true || p.__toastSuccess === 'true';
    const meta = { kind: 'button', toastSuccess, successMessage: p.__successMessage };
    p.onClick = uiAuditWrap(p['data-action'] || 'Button.onClick', p.onClick, meta);
    p.__wrapped_audit = true;
  }
  // Remover flags internas/atributos não-dom
  delete p.__wrapped_audit;
  if ('__perm' in p) delete p.__perm;
  if ('__sensitive' in p) delete p.__sensitive;
  if ('__toastSuccess' in p) delete p.__toastSuccess;
  if ('__successMessage' in p) delete p.__successMessage;
  return p;
}

/**
 * @returns {Window & {
 *   __entityGuardCache?: Map<string, {allowed: boolean, ts: number}>,
 *   __entityGuardInflight?: Map<string, Promise<void>>
 * }}
 */
function getGuardWindow() {
  return window;
}

export { Button, buttonVariants }
