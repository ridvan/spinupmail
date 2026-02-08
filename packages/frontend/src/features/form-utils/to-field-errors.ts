export const toFieldErrors = (errors: unknown[] | undefined) => {
  if (!errors) return [];

  return errors
    .map(error => {
      if (typeof error === "string") return { message: error };

      if (error instanceof Error) return { message: error.message };

      if (
        typeof error === "object" &&
        error !== null &&
        "message" in error &&
        typeof (error as { message?: unknown }).message === "string"
      ) {
        return { message: (error as { message: string }).message };
      }

      return undefined;
    })
    .filter((item): item is { message: string } => Boolean(item?.message));
};
