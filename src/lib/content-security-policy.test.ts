/**
 * The console's policy (content-security-policy.ts): scripts only with the
 * nonce, never framed, nothing but the API and Keycloak beyond its own origin
 * for requests and forms; reporting until CSP_MODE=enforce.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  contentSecurityPolicy,
  cspHeaderName,
  cspMode,
  newNonce,
  originOf,
  type PolicyInput,
} from "./content-security-policy";

const PRODUCTION: PolicyInput = {
  nonce: "bm9uY2U=",
  mode: "enforce",
  development: false,
  https: true,
  apiUrl: "https://api.yildizskylab.com/api/skynotify/v1",
  issuer: "https://e.yildizskylab.com/realms/e-skylab",
};

function directives(policy: string): Map<string, string[]> {
  return new Map(
    policy.split("; ").map((directive) => {
      const [name, ...sources] = directive.split(" ");
      return [name, sources];
    }),
  );
}

describe("the mode", () => {
  it("reports only, unless told to enforce", () => {
    for (const value of [undefined, "", "report-only", "on", "true", "enforced"]) assert.equal(cspMode(value), "report-only", String(value));
    for (const value of ["enforce", " Enforce ", "ENFORCE"]) assert.equal(cspMode(value), "enforce", value);
  });

  it("names the header for each", () => {
    assert.equal(cspHeaderName("report-only"), "Content-Security-Policy-Report-Only");
    assert.equal(cspHeaderName("enforce"), "Content-Security-Policy");
  });
});

describe("the policy", () => {
  const policy = directives(contentSecurityPolicy(PRODUCTION));

  it("runs scripts only with the nonce and what they load", () => {
    assert.deepEqual(policy.get("script-src"), ["'self'", "'nonce-bm9uY2U='", "'strict-dynamic'"]);
    assert.ok(!policy.get("script-src")!.includes("'unsafe-inline'"));
    assert.ok(!policy.get("script-src")!.includes("'unsafe-eval'"));
  });

  it("is never framed, embeds no plugin and moves no base URL", () => {
    assert.deepEqual(policy.get("frame-ancestors"), ["'none'"]);
    assert.deepEqual(policy.get("object-src"), ["'none'"]);
    assert.deepEqual(policy.get("base-uri"), ["'none'"]);
    assert.deepEqual(policy.get("default-src"), ["'self'"]);
  });

  it("lets Monaco start its workers", () => {
    assert.deepEqual(policy.get("worker-src"), ["'self'", "blob:"]);
  });

  it("calls only its own origin and the API's, and posts forms only there and to Keycloak", () => {
    assert.deepEqual(policy.get("connect-src"), ["'self'", "https://api.yildizskylab.com"]);
    assert.deepEqual(policy.get("form-action"), ["'self'", "https://e.yildizskylab.com"]);
  });

  it("keeps a mail preview's styles and images: an srcdoc frame inherits the policy", () => {
    assert.deepEqual(policy.get("style-src"), ["'self'", "'unsafe-inline'"]);
    assert.deepEqual(policy.get("img-src"), ["'self'", "data:", "blob:", "https:"]);
    assert.deepEqual(policy.get("font-src"), ["'self'", "data:", "https:"]);
  });

  it("upgrades insecure requests only when it enforces, over https, outside development", () => {
    assert.ok(policy.has("upgrade-insecure-requests"));
    assert.ok(!directives(contentSecurityPolicy({ ...PRODUCTION, mode: "report-only" })).has("upgrade-insecure-requests"));
    assert.ok(!directives(contentSecurityPolicy({ ...PRODUCTION, https: false })).has("upgrade-insecure-requests"));
    assert.ok(!directives(contentSecurityPolicy({ ...PRODUCTION, development: true })).has("upgrade-insecure-requests"));
  });

  it("lets next dev evaluate and reload", () => {
    const dev = directives(contentSecurityPolicy({ ...PRODUCTION, development: true, apiUrl: "http://localhost:3000/sandbox-api/api/skynotify/v1" }));
    assert.ok(dev.get("script-src")!.includes("'unsafe-eval'"));
    assert.deepEqual(dev.get("connect-src"), ["'self'", "http://localhost:3000", "ws:"]);
  });

  it("adds nothing for a missing or malformed setting", () => {
    const bare = directives(contentSecurityPolicy({ ...PRODUCTION, apiUrl: undefined, issuer: "javascript:alert(1)" }));
    assert.deepEqual(bare.get("connect-src"), ["'self'"]);
    assert.deepEqual(bare.get("form-action"), ["'self'"]);
  });
});

describe("the helpers", () => {
  it("gives each response a nonce of its own", () => {
    const a = newNonce();
    assert.match(a, /^[A-Za-z0-9+/]+=*$/);
    assert.notEqual(a, newNonce());
  });

  it("reads an origin from an http(s) URL only", () => {
    assert.equal(originOf("https://api.yildizskylab.com/api/skynotify/v1"), "https://api.yildizskylab.com");
    assert.equal(originOf("not a url"), null);
    assert.equal(originOf("data:text/plain,x"), null);
    assert.equal(originOf(undefined), null);
  });
});
