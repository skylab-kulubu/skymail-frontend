import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { json, scriptedFetch } from "../api/testing";
import { seedToken } from "./token";

const CLIENT = {
  KEYCLOAK_TOKEN_URL: "https://e.example.test/realms/e-skylab-sandbox/protocol/openid-connect/token",
  KEYCLOAK_CLIENT_ID: "skymail-seed",
  KEYCLOAK_CLIENT_SECRET: "seed-secret",
};

describe("the Template seed's bearer token", () => {
  it("is the one given, when SKYMAIL_TOKEN is set", async () => {
    const { fetch, calls } = scriptedFetch();

    assert.equal(await seedToken({ ...CLIENT, SKYMAIL_TOKEN: "given" }, fetch), "given");
    assert.equal(calls.length, 0);
  });

  // skymail-backend checks a token by asking Keycloak's userinfo, and Keycloak
  // answers userinfo only for a token that carries the openid scope; a
  // client-credentials token without it was refused as server.unauthorized.
  it("is a client-credentials token that carries the openid scope", async () => {
    const { fetch, calls } = scriptedFetch(json(200, { access_token: "issued" }));

    assert.equal(await seedToken(CLIENT, fetch), "issued");
    assert.equal(calls.length, 1);
    assert.equal(calls[0].method, "POST");
    assert.equal(calls[0].url, CLIENT.KEYCLOAK_TOKEN_URL);
    const form = new URLSearchParams(calls[0].body ?? "");
    assert.deepEqual(Object.fromEntries(form), {
      grant_type: "client_credentials",
      client_id: "skymail-seed",
      client_secret: "seed-secret",
      scope: "openid",
    });
  });

  it("names what is missing when there is neither a token nor a client", async () => {
    const { fetch } = scriptedFetch();

    await assert.rejects(seedToken({ KEYCLOAK_CLIENT_ID: "skymail-seed" }, fetch), /SKYMAIL_TOKEN.*KEYCLOAK_TOKEN_URL/);
  });

  it("gives Keycloak's status but not its body, which can echo the secret", async () => {
    const { fetch } = scriptedFetch(json(401, { error: "unauthorized_client", error_description: "seed-secret" }));

    await assert.rejects(seedToken(CLIENT, fetch), (error: Error) => {
      assert.match(error.message, /HTTP 401/);
      assert.doesNotMatch(error.message, /seed-secret/);
      return true;
    });
  });

  it("says so when Keycloak answers without a token", async () => {
    const { fetch } = scriptedFetch(json(200, {}));

    await assert.rejects(seedToken(CLIENT, fetch), /access_token yok/);
  });
});
