

export const ISL_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export function appendLetter(
  currentText: string,
  letter: string
): string {
  const normalized = letter.toUpperCase();

  if (!ISL_ALPHABET.includes(normalized)) {
    return currentText;
  }

  return currentText + normalized;
}

export function addSpace(currentText: string): string {
  if (!currentText || currentText.endsWith(" ")) {
    return currentText;
  }

  return currentText + " ";
}

export function removeLastCharacter(currentText: string): string {
  return currentText.slice(0, -1);
}
