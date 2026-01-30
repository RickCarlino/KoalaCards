const MNEMONIC_MAX_TERM_LENGTH = 6;

const normalizeTerm = (term: string) => term.trim();

const hasWhitespace = (term: string) => /\s/.test(term);

const isShortEnough = (term: string) =>
  term.length <= MNEMONIC_MAX_TERM_LENGTH;

export const normalizeMnemonicTerm = (term: string) => normalizeTerm(term);

export const isMnemonicEligible = (term: string) => {
  const normalized = normalizeMnemonicTerm(term);
  if (!normalized) {
    return false;
  }
  if (hasWhitespace(normalized)) {
    return false;
  }
  return isShortEnough(normalized);
};

export { MNEMONIC_MAX_TERM_LENGTH };
