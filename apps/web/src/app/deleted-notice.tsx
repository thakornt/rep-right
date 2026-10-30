"use client";

import { CircleCheck } from "lucide-react";
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
    <p role="status" className="flex items-center gap-2 text-sm text-health">
      <CircleCheck aria-hidden size={18} />
      ลบบัญชีและข้อมูลทั้งหมดเรียบร้อยแล้ว
    </p>
  );
}
