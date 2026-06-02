import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    this.setState({ info });
    console.error("ErrorBoundary caught an error", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', background: 'red', color: 'var(--text-primary)', zIndex: 99999, position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, overflow: 'auto' }}>
          <h1>Something went wrong.</h1>
          <pre>{this.state.error?.toString()}</pre>
          <pre>{this.state.info?.componentStack}</pre>
          <button onClick={() => this.setState({ hasError: false })}>Dismiss</button>
        </div>
      );
    }
    return this.props.children;
  }
}
