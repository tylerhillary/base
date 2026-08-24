/**
 * A failure the user is allowed to see.
 *
 * Server Actions must never leak stack traces or internal messages to the
 * browser, so `toActionError` converts anything thrown into a safe result:
 * `AppError` messages are written for humans and pass through, everything else
 * collapses to a generic message and is logged server-side instead.
 */
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const notFound = (message = "Not found") => new AppError(404, message);
export const forbidden = (message = "You do not have access to this") => new AppError(403, message);
export const badRequest = (message: string) => new AppError(400, message);
export const conflict = (message: string) => new AppError(409, message);
export const unauthorized = (message = "Sign in to continue") => new AppError(401, message);

export interface ActionFailure {
  ok: false;
  message: string;
  /** Field-level messages, when the failure came from schema validation. */
  fieldErrors?: Record<string, string>;
}

export interface ActionSuccess<T> {
  ok: true;
  message: string;
  data: T;
}

export type ActionResult<T = undefined> = ActionSuccess<T> | ActionFailure;

export const ok = <T>(data: T, message = ""): ActionSuccess<T> => ({ ok: true, message, data });

export const fail = (message: string, fieldErrors?: Record<string, string>): ActionFailure => ({
  ok: false,
  message,
  ...(fieldErrors ? { fieldErrors } : {})
});

/** Zod-shaped errors expose `flatten()`; used to surface per-field messages. */
interface FlattenableError {
  flatten: () => { fieldErrors: Record<string, string[] | undefined>; formErrors: string[] };
}

const isFlattenable = (error: unknown): error is FlattenableError =>
  typeof error === "object" && error !== null && typeof (error as FlattenableError).flatten === "function";

export const toActionError = (error: unknown): ActionFailure => {
  if (error instanceof AppError) {
    return fail(error.message);
  }

  if (isFlattenable(error)) {
    const flat = error.flatten();
    const fieldErrors = Object.fromEntries(
      Object.entries(flat.fieldErrors)
        .filter(([, messages]) => messages && messages.length > 0)
        .map(([field, messages]) => [field, messages![0]])
    );

    return fail(flat.formErrors[0] ?? "Please check the highlighted fields", fieldErrors);
  }

  // Anything unexpected is a bug: log it here, show the user nothing internal.
  console.error("[action] unhandled error", error);
  return fail("Something went wrong. Please try again.");
};
