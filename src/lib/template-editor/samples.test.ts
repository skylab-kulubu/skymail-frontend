/**
 * The sample values a preview fills a template with: the ones its file in the
 * repo declares, overridden by what the operator types.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { templates } from "../../../emails";
import { repoSample, sampleNames, sampleValues } from "./samples";

describe("the variables a preview asks values for", () => {
  it("are the body's and the subject's, once each, in order", () => {
    assert.deepEqual(sampleNames(["link", "firstName"], "{{.firstName}} için {{.Event}}"), ["Event", "firstName", "link"]);
  });

  it("are the body's alone when the subject has none, or cannot be read", () => {
    assert.deepEqual(sampleNames(["link"], "SKY LAB parola sıfırlama"), ["link"]);
    assert.deepEqual(sampleNames(["link"], "{{.broken"), ["link"]);
  });
});

describe("a template's samples from the repo", () => {
  it("are its file's meta.sample, found by Template key", () => {
    const sample = repoSample(templates, "keycloak.reset-password");
    assert.equal(sample.firstName, "Yusuf");
    assert.match(String(sample.link), /^https:\/\//);
  });

  it("are none for a template the repo does not have", () => {
    assert.deepEqual(repoSample(templates, "event.local-only"), {});
    assert.deepEqual(repoSample(templates, null), {});
  });
});

describe("the values a preview uses", () => {
  it("are what the operator typed, then the repo's, and nothing for the rest", () => {
    assert.deepEqual(
      sampleValues(["firstName", "link", "Event"], { firstName: "Yusuf", link: "https://x", extra: "y" }, { link: "https://kendi" }),
      { firstName: "Yusuf", link: "https://kendi" },
    );
  });

  it("keep a typed empty value, so a conditional section can be seen switched off", () => {
    assert.deepEqual(sampleValues(["firstName"], { firstName: "Yusuf" }, { firstName: "" }), { firstName: "" });
  });
});
