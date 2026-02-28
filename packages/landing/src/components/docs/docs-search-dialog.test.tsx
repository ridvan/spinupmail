import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DocsSearchDialog } from "./docs-search-dialog";

const navigateMock = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigateMock,
}));

describe("DocsSearchDialog", () => {
  it("supports keyboard navigation and enter to navigate", async () => {
    const onClose = vi.fn();

    render(<DocsSearchDialog open onClose={onClose} />);

    const input = screen.getByLabelText("Search documentation");
    fireEvent.change(input, { target: { value: "emails" } });

    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalled();
    });

    expect(onClose).toHaveBeenCalled();
  });
});
