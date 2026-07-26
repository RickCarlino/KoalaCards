export function nextReaderRequestId(currentRequestId: number): number {
  return currentRequestId + 1;
}

export function isCurrentReaderRequest(options: {
  activeRequestId: number;
  requestId: number;
  aborted: boolean;
}): boolean {
  return options.activeRequestId === options.requestId && !options.aborted;
}
