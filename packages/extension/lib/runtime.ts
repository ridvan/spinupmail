import type { RuntimeMessage, RuntimeResponse } from "@/lib/types";

export const sendRuntimeMessage = async (message: RuntimeMessage) => {
  try {
    const response = (await browser.runtime.sendMessage(message)) as
      | RuntimeResponse
      | undefined;

    if (!response || typeof response !== "object" || !("ok" in response)) {
      return {
        error: "No response from extension background",
        ok: false,
      } satisfies RuntimeResponse;
    }

    return response;
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Unable to reach extension background",
      ok: false,
    } satisfies RuntimeResponse;
  }
};
