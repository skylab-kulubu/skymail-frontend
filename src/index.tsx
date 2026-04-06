import { createRoot } from "react-dom/client";

import { ReactKeycloakProvider } from "@react-keycloak/web";
import { keycloak } from "./keycloak";

import App from "./App";
import "./i18n";

const container = document.getElementById("root") as HTMLElement;
const root = createRoot(container);

root.render(
  <ReactKeycloakProvider
    authClient={keycloak}
    initOptions={{
      onLoad: "check-sso",
      checkLoginIframe: false,
      pkceMethod: "S256",
    }}
  >
    <App />
  </ReactKeycloakProvider>
);
