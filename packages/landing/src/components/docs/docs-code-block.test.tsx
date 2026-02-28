import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DocsCodeBlock } from "./docs-code-block";

describe("DocsCodeBlock", () => {
  it("copies code to clipboard", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);

    Object.defineProperty(window.navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });

    render(
      <DocsCodeBlock
        code={{
          id: "example",
          language: "bash",
          title: "Example",
          code: "echo 'hello'",
        }}
      />
    );

    fireEvent.click(
      screen.getByRole("button", { name: /copy example snippet/i })
    );

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith("echo 'hello'");
    });

    expect(
      screen.getByRole("button", { name: /copy example snippet/i }).textContent
    ).toBe("Copied");
  });
});
