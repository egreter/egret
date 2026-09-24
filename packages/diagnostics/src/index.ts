export type DiagnosticLevel = "info" | "warning" | "error";

export interface Diagnostic {
  level: DiagnosticLevel;
  code: string;
  message: string;
  file?: string;
}

export class EgreterError extends Error {
  readonly code: string;
  readonly file?: string;

  constructor(code: string, message: string, file?: string) {
    super(message);
    this.name = "EgreterError";
    this.code = code;
    this.file = file;
  }
}

export function formatError(error: unknown): string {
  if (error instanceof EgreterError) {
    return `[${error.code}] ${error.message}${error.file ? ` (${error.file})` : ""}`;
  }

  if (error instanceof Error) {
    return error.stack ?? error.message;
  }

  return String(error);
}
