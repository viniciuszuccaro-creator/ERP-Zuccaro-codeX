import React from "react";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { cn } from "@/lib/utils";
import FormErrorSummary from "@/components/common/FormErrorSummary";
import useContextoVisual from "@/components/lib/useContextoVisual";

/**
 * FormWrapper
 * - Padroniza RHF + Zod
 * - Carimba multiempresa automaticamente (group_id/empresa_id) via useContextoVisual
 * - Exibe resumo de erros consistente
 * - Garante layout responsivo: w-full h-full
 *
 * Props principais:
 * - schema?: zod schema (opcional)
 * - defaultValues?: any
 * - onSubmit: (dadosCarimbados, methods) => void | Promise<void>
 * - withContext?: boolean (default true)
 * - contextFieldName?: string (default 'empresa_id')
 * - className?: string
 * - children: ReactNode | (methods) => ReactNode
 */
export default function FormWrapper({
  schema,
  defaultValues,
  onSubmit,
  withContext = true,
  contextFieldName = 'empresa_id',
  className = '',
  mode = 'onChange',
  reValidateMode = 'onChange',
  externalData,
  children,
  ...formProps
}) {
  const { carimbarContexto } = useContextoVisual();
  const methods = useForm({
    resolver: schema ? zodResolver(schema) : undefined,
    defaultValues,
    mode,
    reValidateMode,
  });

  const [errorMessages, setErrorMessages] = React.useState([]);

  const handleValid = async (data) => {
    // Suporte a dados externos (formularios controlados legacy)
    if (externalData) {
      const stampedExternal = withContext ? carimbarContexto(externalData, contextFieldName) : externalData;
      if (schema) {
        const parsed = schema.safeParse(stampedExternal);
        if (!parsed.success) {
          const msgs = parsed.error.issues?.map(i => i.message) || ['Verifique os campos destacados.'];
          setErrorMessages(msgs);
          return;
        }
      }
      setErrorMessages([]);
      if (typeof onSubmit === 'function') await onSubmit(stampedExternal, methods);
      return;
    }

    const payload = withContext ? carimbarContexto(data, contextFieldName) : data;
    if (schema) {
      const parsed = schema.safeParse(payload);
      if (!parsed.success) {
        const msgs = parsed.error.issues?.map(i => i.message) || ['Verifique os campos destacados.'];
        setErrorMessages(msgs);
        return;
      }
    }
    setErrorMessages([]);
    if (typeof onSubmit === 'function') {
      await onSubmit(payload, methods);
    }
  };

  const handleInvalid = (formErrors) => {
    try {
      const flat = Object.values(formErrors || {}).flatMap((e) => {
        if (!e) return [];
        const base = e.message ? [e.message] : [];
        const inner = e.types ? Object.values(e.types) : [];
        const nested = e.ref ? [] : [];
        return [...base, ...inner, ...nested].filter(Boolean);
      });
      setErrorMessages(flat.length ? flat : ['Verifique os campos destacados.']);
    } catch (_) {
      setErrorMessages(['Verifique os campos destacados.']);
    }
  };

  return (
    <FormProvider {...methods}>
      <form
        onSubmit={methods.handleSubmit(handleValid, handleInvalid)}
        className={cn('w-full h-full space-y-6', className)}
        {...formProps}
      >
        <FormErrorSummary messages={errorMessages} />
        {typeof children === 'function' ? children(methods) : children}
      </form>
    </FormProvider>
  );
}

// Helper opcional para compor submissões fora do FormWrapper
export function withContextSubmit(handler, carimbar, fieldName = 'empresa_id') {
  return (data, methods) => handler(carimbar ? carimbar(data, fieldName) : data, methods);
}