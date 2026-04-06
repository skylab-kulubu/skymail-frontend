import Keycloak from "keycloak-js";

export const keycloak = new Keycloak({
  clientId: "skymail",
  url: "https://e.yildizskylab.com",
  realm: "e-skylab",
});
