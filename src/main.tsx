import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const BUILD_ID = "v2.5.1-" + new Date().getTime().toString().slice(-5);
console.log(`%c[hGuard] BUILD: ${BUILD_ID}`, "color: #10b981; font-weight: bold; font-size: 14px;");
(window as any).hGuard_Version = BUILD_ID;

createRoot(document.getElementById("root")!).render(
  <App />
);
