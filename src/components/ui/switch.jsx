import * as React from "react"
import { cn } from "@/lib/utils"
import { uiAuditWrap } from "@/components/lib/uiAudit";
import usePermissions from "@/components/lib/usePermissions";

/**
 * @typedef {React.ButtonHTMLAttributes<HTMLButtonElement> & {
 *   checked?: boolean,
 *   onCheckedChange?: (checked: boolean) => void,
 *   'data-permission'?: string,
 *   'data-action'?: string,
 *   'data-toast-success'?: boolean|string,
 *   __wrapped_audit?: boolean
 * }} SwitchProps
 */

/** @type {React.ForwardRefExoticComponent<SwitchProps & React.RefAttributes<HTMLButtonElement>>} */
const Switch = React.forwardRef(({ className, checked, onCheckedChange, disabled, ...props }, ref) => {
  const handleClick = () => {
    if (!disabled && onCheckedChange) {
      onCheckedChange(!checked);
    }
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={handleClick}
      ref={ref}
      className={cn(
        "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-blue-600" : "bg-slate-200",
        className
      )}
      {...props}
    >
      <span
        className={cn(
          "pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform",
          checked ? "translate-x-5" : "translate-x-0"
        )}
      />
    </button>
  );
});

Switch.displayName = "Switch"

/** @type {React.ForwardRefExoticComponent<SwitchProps & React.RefAttributes<HTMLButtonElement>>} */
const AuditedSwitch = React.forwardRef(({ onCheckedChange, ...props }, ref) => {
  const { hasPermissionKey } = usePermissions();
  const actionName = props?.['data-action'] || 'Switch.onCheckedChange';
  const toastSuccess = props?.['data-toast-success'] === true || props?.['data-toast-success'] === 'true';
  const audited = typeof onCheckedChange === 'function'
    ? uiAuditWrap(actionName, onCheckedChange, { kind: 'switch', toastSuccess })
    : undefined;
  const { __wrapped_audit, ...cleanProps } = props;
  const perm = cleanProps?.['data-permission'];

  if ('data-permission' in cleanProps) delete cleanProps['data-permission'];
  if ('data-toast-success' in cleanProps) delete cleanProps['data-toast-success'];

  if (perm) {
    const allowed = hasPermissionKey(perm);
    if (!allowed) {
      return (
        <span
          className="inline-flex h-6 min-w-11 items-center justify-center rounded-full border border-dashed px-2 text-[10px] text-slate-400 select-none"
          aria-disabled="true"
        >
          Bloq.
        </span>
      );
    }
  }

  return <Switch ref={ref} onCheckedChange={audited} {...cleanProps} />;
});
AuditedSwitch.displayName = "AuditedSwitch";

export { AuditedSwitch as Switch }
