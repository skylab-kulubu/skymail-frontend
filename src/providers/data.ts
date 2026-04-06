import { createSimpleRestDataProvider } from "@refinedev/rest/simple-rest";
import { API_URL } from "./constants";
import { keycloak } from "../keycloak";

export const { dataProvider, kyInstance } = createSimpleRestDataProvider({
  apiURL: API_URL,
  kyOptions: {
    hooks: {
      beforeRequest: [
        async (request) => {
          try {
            if (keycloak?.authenticated) {
              await keycloak.updateToken(5);
            }
          } catch (error) {
            console.error("Failed to update keycloak token", error);
          }
          if (keycloak?.token) {
            request.headers.set("Authorization", `Bearer ${keycloak.token}`);
          }
        },
      ],
    },
  },
});
