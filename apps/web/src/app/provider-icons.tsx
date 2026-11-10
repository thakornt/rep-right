// Sign-in provider marks, used on the sign-in buttons and the profile page.
// Google's "G" must stay in its own colours and unaltered.

export function GoogleG() {
  return (
    <svg aria-hidden viewBox="0 0 48 48" className="h-5 w-5 shrink-0">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

// Stand-in for LINE's official button icon: swap in the asset from LINE's
// Login button guidelines before launch.
export function LineIcon() {
  return (
    <svg aria-hidden viewBox="0 0 40 40" className="h-7 w-7 shrink-0">
      <path
        fill="#fff"
        d="M20 4C10.6 4 3 10.1 3 17.7c0 6.8 6 12.5 14.2 13.5.6.1 1.3.4 1.5.9.2.4.1 1.1.1 1.6l-.2 1.5c-.1.4-.3 1.7 1.5.9 1.8-.8 9.8-5.8 13.4-9.9C36 23.5 37 20.7 37 17.7 37 10.1 29.4 4 20 4z"
      />
      <text x="20" y="21.5" textAnchor="middle" fontSize="8.5" fontWeight="800" fill="#06C755" fontFamily="system-ui, sans-serif">
        LINE
      </text>
    </svg>
  );
}
