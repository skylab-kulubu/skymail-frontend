/**
 * A management list's view — which records (Aktif · Arşivli · Hepsi) and which
 * page — lives in the address, so a refresh, the back button or a shared link
 * shows the same rows. These tests pin the address ↔ view ↔ API query mapping.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  LIFECYCLE_FILTERS,
  knownPageCount,
  listViewHref,
  listViewQuery,
  pageCount,
  pageToMoveTo,
  readListView,
  readOption,
  readPage,
  viewHref,
} from "./list-view";

const view = (search: string) => readListView(new URLSearchParams(search));

describe("the archive filter", () => {
  it("offers Aktif, Arşivli and Hepsi in that order, as the API's lifecycle values", () => {
    assert.deepEqual(
      LIFECYCLE_FILTERS.map((filter) => [filter.value, filter.label]),
      [
        ["current", "Aktif"],
        ["inactive", "Arşivli"],
        ["all", "Hepsi"],
      ],
    );
  });

  it("shows the current records when the address names none", () => {
    assert.deepEqual(view(""), { lifecycle: "current", page: 1 });
  });

  it("reads the filter from the address", () => {
    assert.equal(view("lifecycle=inactive").lifecycle, "inactive");
    assert.equal(view("lifecycle=all").lifecycle, "all");
  });

  // A hand-edited or stale address must not make the API answer 400.
  it("falls back to the current records for a value the API does not know", () => {
    assert.equal(view("lifecycle=deleted").lifecycle, "current");
    assert.equal(view("lifecycle=constructor").lifecycle, "current");
  });
});

describe("the page", () => {
  it("reads a positive whole page number and ignores anything else", () => {
    assert.equal(view("page=3").page, 3);
    assert.equal(view("page=0").page, 1);
    assert.equal(view("page=-2").page, 1);
    assert.equal(view("page=2.5").page, 1);
    assert.equal(view("page=abc").page, 1);
  });

  it("counts at least one page, so an empty list still has somewhere to be", () => {
    assert.equal(pageCount(0, 25), 1);
    assert.equal(pageCount(25, 25), 1);
    assert.equal(pageCount(26, 25), 2);
  });
});

describe("the API query", () => {
  it("asks for the filter and the page's slice with _start and _end", () => {
    assert.deepEqual(listViewQuery({ lifecycle: "inactive", page: 1 }, 25), {
      lifecycle: "inactive",
      _start: 0,
      _end: 25,
    });
    assert.deepEqual(listViewQuery({ lifecycle: "current", page: 3 }, 25), {
      lifecycle: "current",
      _start: 50,
      _end: 75,
    });
  });
});

describe("the address", () => {
  it("leaves the defaults out", () => {
    assert.equal(listViewHref("/mailing-lists", { lifecycle: "current", page: 1 }), "/mailing-lists");
  });

  it("carries the filter and a later page", () => {
    assert.equal(
      listViewHref("/mailing-lists", { lifecycle: "inactive", page: 2 }),
      "/mailing-lists?lifecycle=inactive&page=2",
    );
    assert.equal(listViewHref("/mailing-lists", { lifecycle: "all", page: 1 }), "/mailing-lists?lifecycle=all");
  });

  it("reads back the view it wrote", () => {
    const written = { lifecycle: "all", page: 4 } as const;
    const search = listViewHref("/x", written).split("?")[1];
    assert.deepEqual(view(search), written);
  });
});

// Any list keeps its view the same way, whatever its filter is called.
describe("a view in the address, for any list", () => {
  const STATES = [{ value: "all" }, { value: "draft" }] as const;

  it("reads one of the filter's values under its own name, else the default", () => {
    assert.equal(readOption(new URLSearchParams("state=draft"), "state", STATES, "all"), "draft");
    assert.equal(readOption(new URLSearchParams("state=nope"), "state", STATES, "all"), "all");
    assert.equal(readOption(new URLSearchParams("lifecycle=draft"), "state", STATES, "all"), "all");
  });

  it("reads the page", () => {
    assert.equal(readPage(new URLSearchParams("page=4")), 4);
    assert.equal(readPage(new URLSearchParams("page=0")), 1);
  });

  it("writes what differs from the defaults, in the order given", () => {
    assert.equal(viewHref("/x", { state: ["draft", "all"], page: [2, 1] }), "/x?state=draft&page=2");
    assert.equal(viewHref("/x", { state: ["all", "all"], page: [1, 1] }), "/x");
  });
});

describe("how many pages there are", () => {
  it("is the API's count when it sent one", () => {
    assert.equal(knownPageCount({ total: 0, rows: 0 }, 1, 25), 1);
    assert.equal(knownPageCount({ total: 26, rows: 25 }, 1, 25), 2);
  });

  // Without X-Total-Count a full page may have another after it.
  it("is one more than this page when this one is full and the total is unknown", () => {
    assert.equal(knownPageCount({ total: null, rows: 25 }, 3, 25), 4);
    assert.equal(knownPageCount({ total: null, rows: 7 }, 3, 25), 3);
  });
});

describe("a page past the end", () => {
  // Its last row archived, or a stale link: the list moves to the last page there is.
  it("moves to the last page there is", () => {
    assert.equal(pageToMoveTo(5, 3), 3);
  });

  it("stays while the count is unknown or the page exists", () => {
    assert.equal(pageToMoveTo(5, null), null);
    assert.equal(pageToMoveTo(3, 3), null);
    assert.equal(pageToMoveTo(1, 1), null);
  });
});
