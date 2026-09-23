/**
 * The sample values a preview fills a template with: the ones its file in the
 * repo declares, overridden by what the operator types.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { templates } from "../../../emails";
import { defaultSample, readTypedSamples, repoSample, sampleNames, sampleValues, writeTypedSamples } from "./samples";

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

describe("a value a common variable is shown with", () => {
  it("is a realistic one, whatever the name's case", () => {
    assert.equal(defaultSample("FirstName"), "Ayşe");
    assert.equal(defaultSample("firstName"), "Ayşe");
    assert.equal(defaultSample("FullName"), "Ayşe Yılmaz");
    assert.equal(defaultSample("Email"), "ayse.yilmaz@example.com");
    assert.equal(defaultSample("EventName"), "GECEKODU 2026");
  });

  it("is an address for a link", () => {
    for (const name of ["link", "VerifyURL", "EventUrl", "CtaUrl", "resetLink"]) {
      assert.match(String(defaultSample(name)), /^https:\/\//, name);
    }
  });

  it("is none for a name it cannot guess", () => {
    assert.equal(defaultSample("Serial"), undefined);
  });
});

describe("the values a preview uses", () => {
  it("are what the operator typed, then the repo's, then a guess for a common name, and nothing for the rest", () => {
    assert.deepEqual(
      sampleValues(["firstName", "link", "Event", "EventName"], { firstName: "Yusuf", link: "https://x", extra: "y" }, { link: "https://kendi" }),
      { firstName: "Yusuf", link: "https://kendi", EventName: "GECEKODU 2026" },
    );
  });

  it("keep a typed empty value, so a conditional section can be seen switched off", () => {
    assert.deepEqual(sampleValues(["firstName"], { firstName: "Yusuf" }, { firstName: "" }), { firstName: "" });
  });
});

describe("what the operator typed, kept for the next visit", () => {
  const memory = () => {
    const items = new Map<string, string>();
    return {
      getItem: (key: string) => items.get(key) ?? null,
      setItem: (key: string, value: string) => void items.set(key, value),
    };
  };

  it("comes back per template", () => {
    const storage = memory();
    writeTypedSamples(storage, "template-1", { FirstName: "Zeynep" });
    assert.deepEqual(readTypedSamples(storage, "template-1"), { FirstName: "Zeynep" });
    assert.deepEqual(readTypedSamples(storage, "template-2"), {});
  });

  it("is nothing when storage is blocked or holds something else", () => {
    const blocked = {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
    };
    assert.doesNotThrow(() => writeTypedSamples(blocked, "template-1", { FirstName: "Zeynep" }));
    assert.deepEqual(readTypedSamples(blocked, "template-1"), {});
    const odd = memory();
    odd.setItem("skymail.template-samples.template-1", '{"FirstName": 5, "x": "y"}');
    assert.deepEqual(readTypedSamples(odd, "template-1"), { x: "y" });
    odd.setItem("skymail.template-samples.template-1", "not json");
    assert.deepEqual(readTypedSamples(odd, "template-1"), {});
  });
});
