import "@testing-library/jest-dom";

if (!globalThis.fetch) {
  Object.defineProperty(globalThis, "fetch", {
    configurable: true,
    writable: true,
    value: jest.fn(() => Promise.reject(new Error("fetch not implemented in tests"))) as typeof fetch,
  });
}
