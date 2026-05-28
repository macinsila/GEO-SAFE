import React from "react";

export type FormMessageTone = "success" | "error" | "warning" | "info";

export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <span className="form-field-error" id={id} role="alert">
      {message}
    </span>
  );
}

export function FormStatus({
  tone,
  title,
  children,
  actions,
}: {
  tone: FormMessageTone;
  title: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className={`form-status ${tone}`} role={tone === "error" ? "alert" : "status"}>
      <div>
        <strong>{title}</strong>
        <p>{children}</p>
      </div>
      {actions ? <div className="form-status-actions">{actions}</div> : null}
    </div>
  );
}

