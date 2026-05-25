import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initCapacitor } from "./lib/capacitor-init";

const BUILD_ID = "v2.5.2-" + new Date().getTime().toString().slice(-5);
console.log(`%c[hGuard] BUILD: ${BUILD_ID}`, "color: #10b981; font-weight: bold; font-size: 14px;");
(window as any).hGuard_Version = BUILD_ID;

// Initialize Capacitor native plugins (no-op on web)
initCapacitor();

import React from "react";

class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: Error | null}> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 20, color: 'red', background: 'black', minHeight: '100vh', wordWrap: 'break-word' }}>
          <h2>Application Crashed</h2>
          <pre style={{ fontSize: '10px' }}>{this.state.error?.message}</pre>
          <pre style={{ fontSize: '10px' }}>{this.state.error?.stack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
