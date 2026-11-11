import * as React from "react"
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group"
import { Circle } from "lucide-react"

import { cn } from "@/lib/utils"
import { uiAuditWrap } from "@/components/lib/uiAudit";
import usePermissions from "@/components/lib/usePermissions";

/** @type {React.ForwardRefExoticComponent<React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root> & React.RefAttributes<React.ElementRef<typeof RadioGroupPrimitive.Root>>>} */
const RadioGroup = React.forwardRef(({ className, ...props }, ref) => {
  return <RadioGroupPrimitive.Root className={cn("grid gap-2", className)} {...props} ref={ref} />;
})
RadioGroup.displayName = RadioGroupPrimitive.Root.displayName

/** @type {React.ForwardRefExoticComponent<React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item> & React.RefAttributes<React.ElementRef<typeof RadioGroupPrimitive.Item>>>} */
const RadioGroupItem = React.forwardRef(({ className, ...props }, ref) => {
  return (
    <RadioGroupPrimitive.Item
      ref={ref}
      className={cn(
        "aspect-square h-4 w-4 rounded-full border border-primary text-primary shadow focus:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      <RadioGroupPrimitive.Indicator className="flex items-center justify-center">
        <Circle className="h-3.5 w-3.5 fill-primary" />
      </RadioGroupPrimitive.Indicator>
    </RadioGroupPrimitive.Item>
  );
})
RadioGroupItem.displayName = RadioGroupPrimitive.Item.displayName

/** @type {React.ForwardRefExoticComponent<React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root> & {'data-permission'?: string, 'data-toast-success'?: boolean|'true'|'false', 'data-action'?: string, __wrapped_audit?: unknown} & React.RefAttributes<React.ElementRef<typeof RadioGroupPrimitive.Root>>>} */
const AuditedRadioGroup = React.forwardRef(({ onValueChange, ...props }, ref) => {
  const { hasPermissionKey } = usePermissions();
  const toastSuccess = props?.['data-toast-success'] === true || props?.['data-toast-success'] === 'true';
  const audited = typeof onValueChange === 'function'
    ? uiAuditWrap(props?.['data-action'] || 'RadioGroup.onValueChange', onValueChange, { kind: 'radio', toastSuccess })
    : undefined;
  const { __wrapped_audit, ...cleanProps } = props;
  const perm = cleanProps?.['data-permission'];

  if ('data-permission' in cleanProps) delete cleanProps['data-permission'];
  if ('data-toast-success' in cleanProps) delete cleanProps['data-toast-success'];

  if (perm) {
    const allowed = hasPermissionKey(perm);
    if (!allowed) {
      return (
        <span className="inline-flex min-h-9 w-full items-center rounded-md border border-dashed px-3 text-xs text-slate-400 select-none">
          Acesso negado
        </span>
      );
    }
  }

  return <RadioGroup ref={ref} onValueChange={audited} {...cleanProps} />;
});
AuditedRadioGroup.displayName = "AuditedRadioGroup";

export { AuditedRadioGroup as RadioGroup, RadioGroupItem }
