const { useState } = React;

// Error boundary + small icon helpers
const Components = (() => {
  class ErrorBoundary extends React.Component {
    constructor(props){ super(props); this.state = { hasError:false, error:null }; }
    static getDerivedStateFromError(error){ return { hasError:true, error }; }
    componentDidCatch(error, info){ console.error("ErrorBoundary caught:", error, info); }
    render(){
      if(this.state.hasError){
        return (
          <div className="min-h-screen flex items-center justify-center p-6">
            <div className="max-w-xl w-full bg-red-50 border border-red-200 rounded-xl p-6">
              <h2 className="text-xl font-bold text-red-700 mb-2">Something went wrong</h2>
              <p className="text-red-800 text-sm whitespace-pre-wrap">{String(this.state.error)}</p>
              <p className="text-gray-600 text-xs mt-2">Open the browser console for details (F12 → Console).</p>
            </div>
          </div>
        );
      }
      return this.props.children;
    }
  }

  const IconWrapper = ({ children, className="", size=24 }) => (
    <span className={`inline-flex items-center justify-center rounded-full ${className}`}
          style={{ width:size, height:size, fontSize:size*0.6 }}>{children}</span>
  );

  const Icons = {
    Calculator: (p) => <IconWrapper {...p}>💷</IconWrapper>,
    Home:       (p) => <IconWrapper {...p}>🏠</IconWrapper>,
    Piggy:      (p) => <IconWrapper {...p}>🐷</IconWrapper>,
    Trend:      (p) => <IconWrapper {...p}>📈</IconWrapper>,
    Building:   (p) => <IconWrapper {...p}>🏢</IconWrapper>,
    Balance:    (p) => <IconWrapper {...p}>⚖️</IconWrapper>,
    Save:       (p) => <IconWrapper {...p}>💾</IconWrapper>,
    Load:       (p) => <IconWrapper {...p}>📂</IconWrapper>,
    Trash:      (p) => <IconWrapper {...p}>🗑️</IconWrapper>,
    User:       (p) => <IconWrapper {...p}>👤</IconWrapper>,
    Logout:     (p) => <IconWrapper {...p}>🚪</IconWrapper>,
  };

  return { ErrorBoundary, Icons };
})();

window.Components = Components;
