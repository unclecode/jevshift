/** Nested bounds: stop the transfer before the host, and the host before the selection wait. */
export const EVALUATOR_LIMITS = Object.freeze({
  connectSeconds: 2, transferSeconds: 5, processMs: 5500, selectionWaitMs: 6000, responseBytes: 65536,
});
