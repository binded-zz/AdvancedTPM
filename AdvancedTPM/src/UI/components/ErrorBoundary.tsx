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
      const stack = error.stack || '';
      const compStack = (info && info.componentStack) ? info.componentStack : '';
      const payload = `${this.props.name || 'UI'}: ${error.message}\nSTACK:\n${stack}\nCOMPONENT:\n${compStack}`;
      apiSafe.trigger('taxProduction', 'uiError', payload);
      // Log each piece separately so CoHTML doesn't truncate
      console.error('[ATPM] UI crash in ' + (this.props.name || 'unknown') + ': ' + error.message);
      if (stack) console.error('[ATPM] JS stack: ' + stack);
      if (compStack) console.error('[ATPM] Component stack: ' + compStack);
    } catch {}
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
