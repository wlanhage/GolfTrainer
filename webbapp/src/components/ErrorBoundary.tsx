'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = {
  children: ReactNode;
  fallback?: ReactNode;
};

type State = {
  hasError: boolean;
  error: Error | null;
};

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('App error:', error, info);
  }

  reset = () => this.setState({ hasError: false, error: null });

  render() {
    if (!this.state.hasError) return this.props.children;
    if (this.props.fallback) return this.props.fallback;

    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border border-border rounded-2xl p-6 flex flex-col gap-3 text-center">
          <div className="text-4xl">⚠️</div>
          <h2 className="text-xl font-extrabold text-ink">Något gick fel</h2>
          <p className="text-sm text-slate-600">
            En del av appen kraschade oväntat. Vi har loggat felet — försök ladda om sidan.
          </p>
          {this.state.error ? (
            <pre className="text-[10px] text-slate-400 bg-slate-50 rounded p-2 overflow-auto max-h-24 text-left">
              {this.state.error.message}
            </pre>
          ) : null}
          <div className="flex flex-col gap-2 mt-2">
            <button
              onClick={() => {
                this.reset();
                if (typeof window !== 'undefined') window.location.reload();
              }}
              className="btn-primary"
            >
              Ladda om sidan
            </button>
            <button
              onClick={() => {
                this.reset();
                if (typeof window !== 'undefined') window.location.assign('/');
              }}
              className="btn-secondary"
            >
              Till hemskärmen
            </button>
          </div>
        </div>
      </div>
    );
  }
}
