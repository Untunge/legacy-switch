import React, { ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorId: string;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorId: '' };
  }

  static getDerivedStateFromError(): State {
    return {
      hasError: true,
      errorId: Math.random().toString(36).substring(7),
    };
  }

  componentDidCatch(error: Error) {
    console.error('Error:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
          <div className="bg-red-950 border border-red-700 rounded-lg p-6 max-w-md">
            <h2 className="text-xl font-bold text-red-200 mb-4">
              Oops! Something went wrong
            </h2>
            <p className="text-gray-300 mb-4">
              Error ID:{' '}
              <code className="text-xs bg-black p-1">{this.state.errorId}</code>
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full px-4 py-2 bg-purple-700 hover:bg-purple-600 rounded font-medium transition"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
