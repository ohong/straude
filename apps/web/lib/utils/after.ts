import { after as nextAfter } from "next/server";

type NextAfterError = Error & {
  __NEXT_ERROR_CODE?: string;
};

function isOutsideRequestScopeError(error: unknown): error is NextAfterError {
  return error instanceof Error
    && (
      error.message.includes("outside a request scope")
      || (error as NextAfterError).__NEXT_ERROR_CODE === "E468"
    );
}

export function after(task: () => unknown | Promise<unknown>) {
  try {
    nextAfter(async () => {
      await task();
    });
  } catch (error) {
    if (!isOutsideRequestScopeError(error)) throw error;
    Promise.resolve().then(task).catch(() => {});
  }
}
