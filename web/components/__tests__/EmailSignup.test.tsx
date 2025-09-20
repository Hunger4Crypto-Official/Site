 codex/suggest-improvements-for-web-portion-hqrpi8
/* eslint-env jest */

 codex/suggest-improvements-for-web-portion
 main
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import EmailSignup from "../EmailSignup";

 codex/suggest-improvements-for-web-portion-hqrpi8
declare const describe: (name: string, fn: () => void) => void;
declare const it: (name: string, fn: () => Promise<void> | void) => void;
declare const beforeEach: (fn: () => void) => void;
declare const afterEach: (fn: () => void) => void;
declare const expect: (value: unknown) => any;
declare const jest: any;

 main
describe("EmailSignup", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("clears the status reset timer when unmounted before it fires", async () => {
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue({ ok: true, json: async () => ({ success: true }) } as unknown as Response);

    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

    const { unmount } = render(<EmailSignup />);

    await user.type(screen.getByPlaceholderText(/your@email.com/i), "tester@example.com");
    await user.click(screen.getByRole("button", { name: /subscribe/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    unmount();

    act(() => {
      jest.runOnlyPendingTimers();
    });

    const hasUnmountWarning = consoleErrorSpy.mock.calls.some(([message]) => {
      return (
        typeof message === "string" &&
        message.includes("Can't perform a React state update on an unmounted component")
      );
    });

    expect(hasUnmountWarning).toBe(false);

 codex/suggest-improvements-for-web-portion-hqrpi8
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
 main
 main
  });
});
