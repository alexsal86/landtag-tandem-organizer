import React from 'react';
import { debugConsole } from '@/utils/debugConsole';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallbackMessage?: string;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    debugConsole.error('ErrorBoundary caught:', error, errorInfo);
    console.error('[ErrorBoundary] name:', error.name, 'message:', error.message);
    console.error('[ErrorBoundary] stack:', error.stack);
    console.error('[ErrorBoundary] componentStack:', errorInfo.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex min-h-64 min-w-0 flex-col items-center justify-center gap-4 p-6">
          <AlertTriangle className="h-10 w-10 shrink-0 text-destructive" />
          <h2 className="text-lg font-semibold">Etwas ist schiefgelaufen</h2>
          <p className="text-sm text-muted-foreground text-center max-w-md">
            {this.props.fallbackMessage || 'Ein unerwarteter Fehler ist aufgetreten. Bitte laden Sie die Seite neu.'}
          </p>
          {this.state.error && (
            <pre
              tabIndex={0}
              aria-label="Fehlerdetails"
              className="mt-2 min-h-[min(12rem,40dvh)] max-h-[min(28rem,60dvh)] w-full max-w-5xl shrink-0 overflow-y-auto whitespace-pre-wrap [overflow-wrap:anywhere] rounded border bg-muted p-4 text-left text-sm leading-relaxed text-destructive focus-visible:outline focus-visible:outline-ring"
            >
              {this.state.error.message}{'\n'}{this.state.error.stack}
            </pre>
          )}
          <Button onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}>
            Seite neu laden
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
