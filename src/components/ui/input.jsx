import * as React from "react"

import { cn } from "@/lib/utils"
import { uiAuditWrap, logUIIssue } from "@/components/lib/uiAudit";
import usePermissions from "@/components/lib/usePermissions";

/**
 * @typedef {React.InputHTMLAttributes<HTMLInputElement> & {
 *   'data-permission'?: string,
 *   __wrapped_audit?: boolean
 * }} InputProps
 */

/** @type {React.ForwardRefExoticComponent<InputProps & React.RefAttributes<HTMLInputElement>>} */
const Input = React.forwardRef(({ className, type, onChange, onBlur, ...props }, ref) => {
  React.useEffect(() => {
    if (!onChange) {
      logUIIssue({ component: 'Input', issue: 'Sem onChange associado', severity: 'warn', meta: { name: props?.name } });
    }
  }, []);

  const auditedOnChange = typeof onChange === 'function' ? uiAuditWrap('Input.onChange', onChange, { name: props?.name }) : undefined;
  const auditedOnBlur = typeof onBlur === 'function' ? uiAuditWrap('Input.onBlur', onBlur, { name: props?.name }) : undefined;

  // CORREÇÃO CRÍTICA: Remover __wrapped_audit antes de passar para elemento nativo
  const { __wrapped_audit, ...cleanProps } = props;

  // RBAC visual automático: data-permission
  const { hasPermissionKey } = usePermissions();
  const perm = props?.['data-permission'];
  const forwardedProps = { ...cleanProps };
  if ('data-permission' in forwardedProps) delete forwardedProps['data-permission'];
  const isAllowed = perm ? hasPermissionKey(perm) : true;
  if (perm && !isAllowed) {
    return (
      <input
        type={type || 'text'}
        className={cn("flex h-9 w-full rounded-md border border-dashed bg-slate-50 px-3 py-1 text-sm text-slate-400", className)}
        disabled
        placeholder="Acesso negado"
        aria-disabled="true"
      />
    );
  }

  return (
    (<input
      type={type}
      className={cn(
        "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className
      )}
      ref={ref}
      onChange={auditedOnChange}
      onBlur={auditedOnBlur}
      {...forwardedProps} />)
  );
})
Input.displayName = "Input"

export { Input }
