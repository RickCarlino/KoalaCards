export function containsHangul(input: string): boolean {
  return /[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(input);
}
