import { Component } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

/**
 * ErrorBoundary — Capture les erreurs JavaScript non-catchées dans l'arbre React
 * pour éviter un écran blanc total en plein service.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary]', this.props.label || 'App', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center p-8 gap-4 text-[#6B6355]">
          <AlertTriangle className="w-12 h-12 text-amber-500" />
          <h2 className="text-lg font-bold text-[#1A1A1A]">
            Une erreur est survenue{this.props.label ? ` dans ${this.props.label}` : ''}
          </h2>
          <p className="text-sm text-center max-w-md">
            {this.state.error?.message || 'Erreur inattendue. Le module a été isolé pour ne pas affecter le reste de l\'application.'}
          </p>
          <div className="flex gap-3 mt-2">
            <button
              onClick={this.handleReset}
              className="flex items-center gap-2 px-4 py-2 bg-[#C1440E] text-white rounded-lg hover:bg-[#A83A0C] transition-colors text-sm font-semibold"
            >
              <RefreshCw className="w-4 h-4" />
              Réessayer
            </button>
            <button
              onClick={() => window.location.reload()}
              className="flex items-center gap-2 px-4 py-2 bg-[#E8E0D0] text-[#1A1A1A] rounded-lg hover:bg-[#D8D0C0] transition-colors text-sm font-semibold"
            >
              Recharger l'application
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
