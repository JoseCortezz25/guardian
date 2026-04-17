export function parseList(input: string | undefined): string[] {
  if (!input) {
    return [];
  }

  return input
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

export function parseBoolean(input: string | undefined): boolean {
  if (!input) {
    return false;
  }

  const normalized = input.toLowerCase().trim();
  return normalized === 'true' || normalized === '1' || normalized === 'yes';
}
