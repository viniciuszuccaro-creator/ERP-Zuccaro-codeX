import * as React from "react"
import * as CheckboxPrimitive from "@radix-ui/react-checkbox"
import { Check } from "lucide-react"

import { cn } from "@/lib/utils"
import usePermissions from "@/components/lib/usePermissions";

/**
 * @typedef {React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root> & {
 *   'data-permission'?: string,
 *   'data-action'?: string,
 *   'data-toast-success'?: boolean|string,
 *   __wrapped_audit?: boolean
 * }} CheckboxProps
 */

/** @type {React.ForwardRefExoticComponent<CheckboxProps & React.RefAttributes<React.ElementRef<typeof CheckboxPrimitive.Root>>>} */
 const Checkbox = React.forwardRef(({ className, ...props }, ref) => (
   <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      "peer h-4 w-4 shrink-0 rounded-sm border border-primary shadow focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground",
      className
    )}
    {...props}>
    <CheckboxPrimitive.Indicator className={cn("flex items-center justify-center text-current")}>
      <Check className="h-4 w-4" />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
))
Checkbox.displayName = CheckboxPrimitive.Root.displayName

import { uiAuditWrap } from "@/components/lib/uiAudit";

// decorate onCheckedChange if present
const _orig = Checkbox; // keep ref
/** @type {React.ForwardRefExoticComponent<CheckboxProps & React.RefAttributes<React.ElementRef<typeof CheckboxPrimitive.Root>>>} */
const WrappedCheckbox = React.forwardRef((props, ref) => {
  const { hasPermissionKey } = usePermissions();
  const p = { ...props };
  if (typeof p.onCheckedChange === 'function' && !p.__wrapped_audit) {
    const toastSuccess = p['data-toast-success'] === true || p['data-toast-success'] === 'true';
    p.onCheckedChange = uiAuditWrap(p['data-action'] || 'Checkbox.onCheckedChange', p.onCheckedChange, { kind: 'checkbox', toastSuccess });
    p.__wrapped_audit = true;
  }
  const { __wrapped_audit, ...cleanProps } = p;
  const perm = cleanProps?.['data-permission'];
  if ('data-permission' in cleanProps) delete cleanProps['data-permission'];
  if ('data-toast-success' in cleanProps) delete cleanProps['data-toast-success'];
  if (perm) {
    const allowed = hasPermissionKey(perm);
    if (!allowed) {
      return (
        <span className="inline-flex h-4 items-center rounded border border-dashed px-1 text-[10px] text-slate-400 select-none">Acesso negado</span>
      );
    }
  }
  return (<_orig {...cleanProps} ref={ref} />);
});
WrappedCheckbox.displayName = "WrappedCheckbox";

export { WrappedCheckbox as Checkbox }
