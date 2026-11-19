import { describe, expect, it } from "vitest";

import { readRefreshStatus, restoreWithRetry, type RefreshOutcome } from "./session-restore";

describe("readRefreshStatus", () => {
  it.each([
    [200, "ok"],
    [401, "signed-out"],
    [409, "raced"],
    [403, "unavailable"], // proxy secret mismatch: not the user's fault
    [429, "unavailable"],
    [502, "unavailable"],
    [503, "unavailable"],
    [504, "unavailable"], // the proxy gave up while the API was waking
  ])("%i → %s", (status, want) => {
    expect(readRefreshStatus(status)).toBe(want);
  });
});

function run(outcomes: RefreshOutcome[], stopAfter = Infinity) {
  const waits: number[] = [];
  let calls = 0;
  let waiting = 0;
  return restoreWithRetry({
    attempt: async () => outcomes[Math.min(calls++, outcomes.length - 1)],
    sleep: async (ms) => {
      waits.push(ms);
    },
    onWaiting: () => waiting++,
    stop: () => waits.length >= stopAfter,
    delays: [1, 2, 3],
  }).then((result) => ({ result, calls, waits, waiting }));
}

describe("restoreWithRetry", () => {
  it("stops at the first real answer", async () => {
    expect(await run(["ok"])).toEqual({ result: "ok", calls: 1, waits: [], waiting: 0 });
    expect(await run(["signed-out"])).toEqual({ result: "signed-out", calls: 1, waits: [], waiting: 0 });
  });

  it("waits out an API that is waking up instead of signing the user out", async () => {
    expect(await run(["unavailable", "unavailable", "ok"])).toEqual({
      result: "ok",
      calls: 3,
      waits: [1, 2],
      waiting: 2,
    });
  });

  it("gives up as unavailable (not signed out) after the last delay", async () => {
    expect(await run(["unavailable"])).toEqual({ result: "unavailable", calls: 4, waits: [1, 2, 3], waiting: 3 });
  });

  it("stops early when told to", async () => {
    const r = await run(["unavailable"], 1);
    expect(r.calls).toBe(1);
    expect(r.result).toBe("unavailable");
  });
});
