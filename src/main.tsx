import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initCapacitor } from "./lib/capacitor-init";

const BUILD_ID = "v2.5.2-" + new Date().getTime().toString().slice(-5);
console.log(`%c[hGuard] BUILD: ${BUILD_ID}`, "color: #10b981; font-weight: bold; font-size: 14px;");
(window as any).hGuard_Version = BUILD_ID;

// Initialize Capacitor native plugins (no-op on web)
initCapacitor();

createRoot(document.getElementById("root")!).render(
  <App />
);
