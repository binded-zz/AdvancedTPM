import React from 'react';
import apiSafe from '../../mods/apiSafe';

interface Props { children: React.ReactNode; name?: string }
interface State { hasError: boolean; error?: Error | null; info?: any }

class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }

  componentDidCatch(error: Error, info: any) {
    this.setState({ hasError: true, error, info });
    try {
      // Send error to host so it appears in player log. Include stack and component info when possible.
      const payload = `${this.props.name || 'UI'}: ${error.message}\nSTACK:\n${error.stack || ''}\nCOMPONENT_STACK:\n${info && info.componentStack ? info.componentStack : JSON.stringify(info || {})}`;
      apiSafe.trigger('taxProduction', 'uiError', payload);
    } catch {}
    try { console.error('ErrorBoundary caught', error, info); } catch {}
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 12, color: 'white', background: 'rgba(200,40,40,0.9)' }}>
          <div style={{ fontWeight: 700 }}>UI Error</div>
          <div style={{ whiteSpace: 'pre-wrap', marginTop: 6 }}>{this.state.error?.message}</div>
          <div style={{ marginTop: 8 }}><button onClick={() => location.reload()}>Reload UI</button></div>
        </div>
      );
    }
    return this.props.children as any;
  }
}

export default ErrorBoundary;
