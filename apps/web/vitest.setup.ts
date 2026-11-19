import { afterEach } from "vitest";

// The 3D anatomy tests run seconds of synchronous work back to back. Without a
// turn of the event loop between them the worker never reads the runner's
// replies, and after 60 s vitest fails the run with `Timeout calling
// "onTaskUpdate"` even though every test passed. setImmediate runs after the
// I/O poll, so those replies are read between tests.
afterEach(() => new Promise<void>((resolve) => setImmediate(resolve)));
