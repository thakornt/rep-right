// How the program chosen on this device and the one saved on the account are
// merged at sign-in. Kept free of React and fetch so it can be unit tested.

export type ProgramSyncDeps = {
  /** The choice stored in this browser, or null. */
  local: string | null;
  /** The account's choice, or null. */
  fetchAccount: () => Promise<string | null>;
  /** Saves a choice to the account. */
  upload: (id: string) => Promise<unknown>;
  /** Whether an id is a program this app still has. */
  known: (id: string) => boolean;
};

/**
 * Returns the program to use after sign-in: the account's when it has one
 * (the account wins), otherwise this device's, which is then uploaded.
 */
export async function syncProgramAtSignIn({ local, fetchAccount, upload, known }: ProgramSyncDeps): Promise<string | null> {
  const account = await fetchAccount();
  if (account && known(account)) return account;
  if (local && known(local)) {
    await upload(local);
    return local;
  }
  return null;
}
