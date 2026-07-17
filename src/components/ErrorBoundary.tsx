import * as React from "react";

interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
  stack: string | null;
}

/**
 * Captura erros de render de qualquer página. Sem isto, um erro vira tela em
 * branco/preta (o #root fica vazio). Com isto, o usuário vê a mensagem do erro
 * e um botão de recarregar — e a gente consegue diagnosticar pelo texto.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null, stack: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Fica no console do navegador pra facilitar o diagnóstico.
    console.error("[ErrorBoundary] erro de render:", error, info.componentStack);
    // Guarda as primeiras linhas do stack (qual componente quebrou) pra mostrar na tela.
    const stack = (info.componentStack || "")
      .split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 4).join("\n");
    this.setState({ stack });
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-6">
        <div className="max-w-lg w-full rounded-2xl border border-red-500/40 bg-red-500/5 p-6 text-center space-y-4">
          <div className="text-4xl">⚠️</div>
          <h1 className="text-xl font-bold">Algo quebrou nesta tela</h1>
          <p className="text-sm text-muted-foreground">
            Um erro impediu esta parte de carregar. Recarregar costuma resolver. Se
            continuar acontecendo, mande esta mensagem para o suporte:
          </p>
          <pre className="text-left text-xs bg-card border border-border/40 rounded-lg p-3 overflow-auto max-h-52 whitespace-pre-wrap break-words">
            {error.message || String(error)}
            {this.state.stack ? `\n\nem:\n${this.state.stack}` : ""}
          </pre>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90"
            >
              Recarregar
            </button>
            <button
              onClick={() => { window.location.href = "/"; }}
              className="px-4 py-2 rounded-lg border border-border/50 text-sm font-medium hover:bg-muted/40"
            >
              Voltar ao início
            </button>
          </div>
        </div>
      </div>
    );
  }
}
