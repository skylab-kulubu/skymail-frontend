import Keycloak from "keycloak-js";

function requiredEnv(name: string, value: string | undefined): string {
  if (!value) throw new Error(`${name} is required`);
  return value;
}

export const keycloak = new Keycloak({
  clientId: requiredEnv("VITE_KEYCLOAK_CLIENT_ID", import.meta.env.VITE_KEYCLOAK_CLIENT_ID),
  url: requiredEnv("VITE_KEYCLOAK_URL", import.meta.env.VITE_KEYCLOAK_URL),
  realm: requiredEnv("VITE_KEYCLOAK_REALM", import.meta.env.VITE_KEYCLOAK_REALM),
});
