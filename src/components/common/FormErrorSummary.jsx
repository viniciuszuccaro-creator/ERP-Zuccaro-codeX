import React from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";

/** @param {unknown} error */
export function formErrorMessage(error) {
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string' && error.message) return error.message;
  return 'Campo inválido';
}

export default function FormErrorSummary({ messages = [] }) {
  if (!messages || messages.length === 0) return null;
  return (
    <Alert className="border-red-300 bg-red-50">
      <div className="flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5" />
        <AlertDescription className="text-sm text-red-900 space-y-1">
          {messages.map((m, i) => (
            <p key={i}>• {formErrorMessage(m)}</p>
          ))}
        </AlertDescription>
      </div>
    </Alert>
  );
}
