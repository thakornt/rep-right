import { describe, expect, it, vi } from "vitest";

import { syncProgramAtSignIn } from "./program-sync";

const known = (id: string) => ["ppl-2", "upper-lower"].includes(id);

function run(local: string | null, account: string | null) {
  const upload = vi.fn(async () => undefined);
  const result = syncProgramAtSignIn({ local, fetchAccount: async () => account, upload, known });
  return { result, upload };
}

describe("syncProgramAtSignIn", () => {
  it("uploads this device's choice when the account has none", async () => {
    const { result, upload } = run("ppl-2", null);
    expect(await result).toBe("ppl-2");
    expect(upload).toHaveBeenCalledWith("ppl-2");
  });

  it("uses the account's choice when it has one, without uploading", async () => {
    const { result, upload } = run("ppl-2", "upper-lower");
    expect(await result).toBe("upper-lower");
    expect(upload).not.toHaveBeenCalled();
  });

  it("uses the account's choice on a device with none", async () => {
    const { result, upload } = run(null, "upper-lower");
    expect(await result).toBe("upper-lower");
    expect(upload).not.toHaveBeenCalled();
  });

  it("returns null when neither has one", async () => {
    const { result, upload } = run(null, null);
    expect(await result).toBeNull();
    expect(upload).not.toHaveBeenCalled();
  });

  it("does not upload a program id the app no longer has", async () => {
    const { result, upload } = run("old-program", null);
    expect(await result).toBeNull();
    expect(upload).not.toHaveBeenCalled();
  });

  it("propagates a failed account read so the caller keeps its local copy", async () => {
    const upload = vi.fn();
    await expect(
      syncProgramAtSignIn({ local: "ppl-2", fetchAccount: () => Promise.reject(new Error("offline")), upload, known }),
    ).rejects.toThrow("offline");
    expect(upload).not.toHaveBeenCalled();
  });
});
