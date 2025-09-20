import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import EmailSignup from "../EmailSignup";

describe("EmailSignup", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("clears the reset timeout when the component unmounts", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({}),
    } as Response);
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const { unmount } = render(<EmailSignup />);

    fireEvent.change(screen.getByPlaceholderText("your@email.com"), {
      target: { value: "test@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /subscribe/i }));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByText(/thanks for subscribing/i)).toBeInTheDocument();

    unmount();
    vi.runAllTimers();

    expect(consoleErrorSpy).not.toHaveBeenCalledWith(
      expect.stringContaining(
        "Can't perform a React state update on an unmounted component."
      )
    );
  });
});
