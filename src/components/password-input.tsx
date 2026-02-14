"use client";

import { useId, useState, type InputHTMLAttributes } from "react";

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

function EyeIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6Z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M3 3l18 18" />
      <path d="M10.6 6.3c.5-.2 1-.3 1.4-.3 6.4 0 10 6 10 6a17.4 17.4 0 0 1-4.4 4.7" />
      <path d="M6.6 6.7A17.7 17.7 0 0 0 2 12s3.6 6 10 6c1.6 0 3-.4 4.1-1.1" />
      <path d="M14.1 14.1A3 3 0 0 1 9.9 9.9" />
    </svg>
  );
}

export function PasswordInput({ id, className, ...props }: PasswordInputProps) {
  const generatedId = useId();
  const [visible, setVisible] = useState(false);
  const inputId = id ?? generatedId;
  const buttonLabel = visible ? "Hide password" : "Show password";

  return (
    <span className="password-field">
      <input
        {...props}
        id={inputId}
        type={visible ? "text" : "password"}
        className={className}
      />
      <button
        type="button"
        className="password-toggle"
        aria-label={buttonLabel}
        aria-controls={inputId}
        aria-pressed={visible}
        onClick={() => setVisible((state) => !state)}
      >
        <EyeIcon open={visible} />
      </button>
    </span>
  );
}
