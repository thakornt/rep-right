"use client";

import { useEffect, useState } from "react";

/** Confirms an account deletion after /account redirects to "/?deleted=1". */
export function DeletedNotice() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    // Read the query on the client so the home page stays fully static.
    if (new URLSearchParams(window.location.search).has("deleted")) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShow(true);
      window.history.replaceState(null, "", "/");
    }
  }, []);
  if (!show) return null;
  return (
    <p role="status" className="rounded-xl border border-emerald-600/40 p-4 text-sm">
      ลบบัญชีและข้อมูลทั้งหมดเรียบร้อยแล้ว
    </p>
  );
}
