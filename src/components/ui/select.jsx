import * as React from "react"
import * as SelectPrimitive from "@radix-ui/react-select"
import { Check, ChevronDown, ChevronUp } from "lucide-react"
import { cn } from "@/lib/utils"
import usePermissions from "@/components/lib/usePermissions";

const Select = SelectPrimitive.Root

const SelectGroup = SelectPrimitive.Group

const SelectValue = SelectPrimitive.Value
const NULL_SELECT_VALUE = "__erp_select_null__"
const EMPTY_SELECT_VALUE = "__erp_select_empty__"

/** @type {React.ForwardRefExoticComponent<React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger> & React.RefAttributes<React.ElementRef<typeof SelectPrimitive.Trigger>>>} */
const SelectTrigger = React.forwardRef(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1",
      className
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown className="h-4 w-4 opacity-50" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
))
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName

/** @type {React.ForwardRefExoticComponent<React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollUpButton> & React.RefAttributes<React.ElementRef<typeof SelectPrimitive.ScrollUpButton>>>} */
const SelectScrollUpButton = React.forwardRef(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollUpButton
    ref={ref}
    className={cn(
      "flex cursor-default items-center justify-center py-1",
      className
    )}
    {...props}
  >
    <ChevronUp className="h-4 w-4" />
  </SelectPrimitive.ScrollUpButton>
))
SelectScrollUpButton.displayName = SelectPrimitive.ScrollUpButton.displayName

/** @type {React.ForwardRefExoticComponent<React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollDownButton> & React.RefAttributes<React.ElementRef<typeof SelectPrimitive.ScrollDownButton>>>} */
const SelectScrollDownButton = React.forwardRef(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollDownButton
    ref={ref}
    className={cn(
      "flex cursor-default items-center justify-center py-1",
      className
    )}
    {...props}
  >
    <ChevronDown className="h-4 w-4" />
  </SelectPrimitive.ScrollDownButton>
))
SelectScrollDownButton.displayName = SelectPrimitive.ScrollDownButton.displayName

/** @type {React.ForwardRefExoticComponent<React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content> & React.RefAttributes<React.ElementRef<typeof SelectPrimitive.Content>>>} */
const SelectContent = React.forwardRef(({ className, children, position = "popper", ...props }, ref) => (
  <SelectPrimitive.Portal container={typeof document !== 'undefined' ? document.body : undefined}>
    <SelectPrimitive.Content
      ref={ref}
      className={cn(
        "relative max-h-96 min-w-[8rem] overflow-hidden rounded-md border bg-white text-slate-900 shadow-xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        position === "popper" &&
          "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
        className
      )}
      position={position}
      sideOffset={5}
      style={{ 
        zIndex: 9999999999,
        position: 'relative'
      }}
      {...props}
    >
      <SelectScrollUpButton />
      <SelectPrimitive.Viewport
        className={cn(
          "p-1",
          position === "popper" &&
            "max-h-[var(--radix-select-content-available-height)] w-full min-w-[var(--radix-select-trigger-width)]"
        )}
      >
        {children}
      </SelectPrimitive.Viewport>
      <SelectScrollDownButton />
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
))
SelectContent.displayName = SelectPrimitive.Content.displayName

/** @type {React.ForwardRefExoticComponent<React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label> & React.RefAttributes<React.ElementRef<typeof SelectPrimitive.Label>>>} */
const SelectLabel = React.forwardRef(({ className, ...props }, ref) => (
  <SelectPrimitive.Label
    ref={ref}
    className={cn("py-1.5 pl-8 pr-2 text-sm font-semibold", className)}
    {...props}
  />
))
SelectLabel.displayName = SelectPrimitive.Label.displayName

/** @type {React.ForwardRefExoticComponent<React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item> & React.RefAttributes<React.ElementRef<typeof SelectPrimitive.Item>>>} */
const SelectItem = React.forwardRef(({ className, children, ...props }, ref) => {
  const normalizedProps = { ...props };
  if (normalizedProps.value === null || normalizedProps.value === undefined) normalizedProps.value = NULL_SELECT_VALUE;
  if (normalizedProps.value === "") normalizedProps.value = EMPTY_SELECT_VALUE;

  return (
    <SelectPrimitive.Item
      ref={ref}
      className={cn(
        "relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-slate-100 focus:text-slate-900 data-[disabled]:pointer-events-none data-[disabled]:opacity-50 hover:bg-slate-100 transition-colors",
        className
      )}
      {...normalizedProps}
    >
      <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <Check className="h-4 w-4" />
        </SelectPrimitive.ItemIndicator>
      </span>

      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
})
SelectItem.displayName = SelectPrimitive.Item.displayName

/** @type {React.ForwardRefExoticComponent<React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator> & React.RefAttributes<React.ElementRef<typeof SelectPrimitive.Separator>>>} */
const SelectSeparator = React.forwardRef(({ className, ...props }, ref) => (
  <SelectPrimitive.Separator
    ref={ref}
    className={cn("-mx-1 my-1 h-px bg-muted", className)}
    {...props}
  />
))
SelectSeparator.displayName = SelectPrimitive.Separator.displayName

import { uiAuditWrap } from "@/components/lib/uiAudit";

// Patch SelectTrigger to audit onValueChange when passed via Root
const _Select = Select;
const _Root = _Select;

/**
 * @param {React.ComponentPropsWithoutRef<typeof SelectPrimitive.Root> & {
 *   __wrapped_audit?: boolean,
 *   'data-action'?: string,
 *   'data-toast-success'?: boolean|string
 * }} props
 */
function withAuditRoot(props) {
  const p = { ...props };
  if (p.value === null) p.value = undefined;
  if (typeof p.onValueChange === 'function' && !p.__wrapped_audit) {
    const originalOnValueChange = p.onValueChange;
    p.onValueChange = (value) => {
      if (value === NULL_SELECT_VALUE) return originalOnValueChange(null);
      if (value === EMPTY_SELECT_VALUE) return originalOnValueChange("");
      return originalOnValueChange(value);
    };
    const toastSuccess = p['data-toast-success'] === true || p['data-toast-success'] === 'true';
    p.onValueChange = uiAuditWrap(p['data-action'] || 'Select.onValueChange', p.onValueChange, { kind: 'select', toastSuccess });
    p.__wrapped_audit = true;
  }
  // CORREÇÃO CRÍTICA: Remove __wrapped_audit before passing to Radix UI
  const { __wrapped_audit, ...cleanProps } = p;
  if ('data-toast-success' in cleanProps) delete cleanProps['data-toast-success'];
  return cleanProps;
}

/**
 * @param {React.ComponentPropsWithoutRef<typeof SelectPrimitive.Root> & {
 *   'data-permission'?: string,
 *   'data-action'?: string,
 *   'data-toast-success'?: boolean|string
 * }} props
 */
const AuditedSelect = (props) => {
  const { hasPermissionKey } = usePermissions();
  const perm = props?.['data-permission'];
  const p = { ...props };
  if ('data-permission' in p) delete p['data-permission'];
  const allowed = perm ? hasPermissionKey(perm) : true;
        if (perm && !allowed) return <span className="inline-flex h-10 items-center rounded-md border border-dashed px-3 text-xs text-slate-400 select-none">Acesso negado</span>;
        return <_Root {...withAuditRoot(p)} />
};

export {
  AuditedSelect as Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
}
