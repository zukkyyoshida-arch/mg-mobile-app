import React, { Component } from 'react';

// Simple Error Boundary to catch rendering errors in child components
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render shows fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // You could log the error to an external service here
    console.error('ErrorBoundary caught an error', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      // Render fallback UI
      return <div style={{ color: 'var(--text-primary)', padding: '12px' }}>
        <h2>何か問題が発生しました。</h2>
        <p>エラーが検出されました。ページをリロードするか、サポートへお問い合わせください。</p>
      </div>;
    }
    // Render children if no error
    return this.props.children;
  }
}
