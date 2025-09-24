import { fireEvent } from "@testing-library/react";

type SetupOptions = {
  advanceTimers?: (ms: number) => void;
};

type User = {
  type: (element: HTMLElement, text: string) => Promise<void>;
  click: (element: Element) => Promise<void>;
};

function updateValue(element: HTMLElement, value: string) {
  const input = element as HTMLInputElement | HTMLTextAreaElement;
  if ("value" in input) {
    Object.defineProperty(input, "value", {
      configurable: true,
      enumerable: true,
      value,
      writable: true,
    });
    fireEvent.input(input, { target: { value } });
  } else {
    fireEvent.input(element, { target: { value } });
  }
}

export function setup(options: SetupOptions = {}): User {
  const maybeAdvance = (ms: number) => {
    try {
      options.advanceTimers?.(ms);
    } catch {
      // ignore timer advance errors
    }
  };

  return {
    async type(element, text) {
      const currentValue = (element as HTMLInputElement | HTMLTextAreaElement).value ?? "";
      let nextValue = currentValue;
      for (const char of text) {
        nextValue += char;
        updateValue(element, nextValue);
        maybeAdvance(0);
        await Promise.resolve();
      }
    },
    async click(element) {
      fireEvent.click(element);
      maybeAdvance(0);
      await Promise.resolve();
    },
  };
}

export default { setup };
