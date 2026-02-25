import { createRoot } from "react-dom/client";

import { ReactKeycloakProvider } from "@react-keycloak/web";
import Keycloak from "keycloak-js";

import App from "./App";

const keycloak = new Keycloak({
  clientId: "skymail",
  url: "https://e.yildizskylab.com",
  realm: "e-skylab",
});

const container = document.getElementById("root") as HTMLElement;
const root = createRoot(container);

root.render(
  <ReactKeycloakProvider authClient={keycloak}>
    <App />
  </ReactKeycloakProvider>
);
