"use client";

import { useState } from "react";

import type { User } from "@/lib/api";

const sizes = { sm: "h-9 w-9 text-sm", lg: "h-20 w-20 text-3xl" };

/** Profile picture from the sign-in provider, or the first letter of the name. */
export function Avatar({ user, size }: { user: User; size: keyof typeof sizes }) {
  const [broken, setBroken] = useState(false);
  const name = user.display_name || user.email || "?";
  const box = `${sizes[size]} shrink-0 rounded-full`;
  if (user.picture_url && !broken) {
    return (
      // Provider-hosted avatars (Google, LINE) at their own size; next/image
      // would proxy them through our server for no gain.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={user.picture_url}
        alt=""
        referrerPolicy="no-referrer"
        className={`${box} bg-raised object-cover`}
        onError={() => setBroken(true)}
      />
    );
  }
  return (
    <span aria-hidden className={`${box} grid place-items-center bg-raised font-semibold text-primary`}>
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}
