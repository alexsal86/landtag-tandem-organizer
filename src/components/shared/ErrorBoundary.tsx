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
        <div className="flex flex-col items-center justify-center h-64 gap-4 p-6">
          <AlertTriangle className="h-10 w-10 text-destructive" />
          <h2 className="text-lg font-semibold">Etwas ist schiefgelaufen</h2>
          <p className="text-sm text-muted-foreground text-center max-w-md">
            {this.props.fallbackMessage || 'Ein unerwarteter Fehler ist aufgetreten. Bitte laden Sie die Seite neu.'}
          </p>
          {this.state.error && (
            <pre className="mt-2 max-h-32 w-full max-w-lg overflow-auto rounded border bg-muted p-2 text-xs text-destructive">
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
