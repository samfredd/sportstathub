// Money is stored and compared as integer minor units (cents/kobo) — never
// floating point — everywhere except this one conversion boundary, where a
// human enters or reads a decimal amount.

export function parseMoneyToMinorUnits(decimalAmount: unknown, fieldName = 'amount'): number {
  const value = Number(decimalAmount);
  if (!Number.isFinite(value) || value < 0) {
    throw Object.assign(new Error(`${fieldName} must be a non-negative number`), { statusCode: 400 });
  }
  const minor = Math.round(value * 100);
  // Reject inputs with more precision than currency minor units support
  // (e.g. 9.999) instead of silently rounding away real value.
  if (Math.abs(minor - value * 100) > 1e-6) {
    throw Object.assign(new Error(`${fieldName} cannot have more than 2 decimal places`), { statusCode: 400 });
  }
  return minor;
}

export function minorUnitsToDecimal(minorUnits: unknown): number {
  const value = Number(minorUnits);
  return Number.isFinite(value) ? value / 100 : 0;
}

// `Number(null) === 0` and `Number.isInteger(0) === true`, so checking
// `Number.isInteger(Number(x))` alone silently treats a genuinely-missing
// *_minor column as a valid zero amount instead of falling back to the
// legacy decimal column. This checks presence first.
export function hasMinorUnitsValue(value: unknown): value is number | string {
  if (value === null || value === undefined) return false;
  return Number.isInteger(Number(value));
}
