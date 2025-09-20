import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import EmailSignup from "../EmailSignup";

declare const describe: (name: string, fn: () => void) => void;
declare const it: (name: string, fn: () => Promise<void> | void) => void;
declare const beforeEach: (fn: () => void) => void;
declare const afterEach: (fn: () => void) => void;
declare const expect: (value: unknown) => any;
declare const jest: any;

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

  });
});
