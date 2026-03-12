'use client';

import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log to console for debugging
    console.error('ErrorBoundary caught an error:', error);
    console.error('Error Info:', errorInfo);

    this.setState({
      error,
      errorInfo
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center px-4">
          <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
            {/* HiMax Branding */}
            <div className="text-6xl mb-4">😊</div>
            <h1 className="text-2xl font-bold text-gray-800 mb-2">
              Oops! Something went wrong
            </h1>
            <p className="text-gray-600 mb-6">
              Don't worry! HiMax had a little hiccup. Let's try again.
            </p>

            {/* Error Details (Development Only) */}
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="bg-gray-100 rounded p-4 mb-6 text-left text-xs text-gray-700 max-h-40 overflow-auto">
                <summary className="font-semibold cursor-pointer mb-2">
                  Error Details (Dev Only)
                </summary>
                <pre className="whitespace-pre-wrap break-words">
                  {this.state.error.toString()}
                </pre>
                {this.state.errorInfo && (
                  <pre className="whitespace-pre-wrap break-words mt-2">
                    {this.state.errorInfo.componentStack}
                  </pre>
                )}
              </details>
            )}

            {/* Try Again Button */}
            <button
              onClick={this.handleReset}
              className="w-full bg-primary text-white font-bold py-3 px-6 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Try Again
            </button>

            {/* Fallback Link */}
            <div className="mt-4">
              <a
                href="/"
                className="text-primary hover:underline text-sm font-semibold"
              >
                ← Go Home
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
