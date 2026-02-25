import { createRoot } from "react-dom/client";

import { ReactKeycloakProvider } from "@react-keycloak/web";
import Keycloak from "keycloak-js";

import App from "./App";

const keycloak = new Keycloak({
  clientId: "refine-demo",
  url: "https://lemur-0.cloud-iam.com/auth",
  realm: "refine",
});

const container = document.getElementById("root") as HTMLElement;
const root = createRoot(container);

root.render(
  <ReactKeycloakProvider authClient={keycloak}>
    <App />
  </ReactKeycloakProvider>
);
