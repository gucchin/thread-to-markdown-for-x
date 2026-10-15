import { describe, expect, it } from 'vitest';
import { EXTRACT_AND_COPY, isExtractAndCopyRequest } from '../src/shared/messages';

describe('isExtractAndCopyRequest', () => {
  it('accepts an EXTRACT_AND_COPY message', () => {
    expect(isExtractAndCopyRequest({ type: EXTRACT_AND_COPY })).toBe(true);
  });

  it.each([null, undefined, 'EXTRACT_AND_COPY', {}, { type: 'OTHER' }])('rejects %o', (message) => {
    expect(isExtractAndCopyRequest(message)).toBe(false);
  });
});
