import React from "react";
import { AlertTriangle } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("ErrorBoundary caught:", error, info);
    try {
      base44.entities?.AuditLog?.create?.({
        usuario: 'UI',
        acao: 'Visualização',
        modulo: 'Sistema',
        tipo_auditoria: 'ui',
        entidade: 'ErrorBoundary',
        descricao: String(error?.message || error),
        dados_novos: { info },
        data_hora: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[ErrorBoundary] Falha ao registrar erro da interface', error);
    }
  }

  handleRetry = () => {
    // resetar estado local; se o erro persistir, podemos forçar reload
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full min-h-[50vh] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white border rounded-xl shadow-sm p-6 text-center">
            <div className="mx-auto mb-3 w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <h2 className="text-lg font-semibold text-slate-900">Ocorreu um erro inesperado</h2>
            <p className="text-slate-600 text-sm mt-1">Tente novamente. Se persistir, recarregue a página.</p>
            <div className="mt-4 flex gap-2 justify-center">
              <button
                className="px-4 py-2 rounded-md bg-slate-800 text-white text-sm hover:bg-slate-700"
                onClick={this.handleRetry}
              >
                Tentar novamente
              </button>
              <button
                className="px-4 py-2 rounded-md border text-sm hover:bg-slate-50"
                onClick={() => window.location.reload()}
              >
                Recarregar
              </button>
            </div>
            {import.meta.env?.DEV && this.state.error && (
              <pre className="text-left text-xs text-slate-500 mt-4 overflow-auto max-h-40">
                {String(this.state.error?.message || this.state.error)}
              </pre>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
