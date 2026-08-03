const DISALLOWED_CHARS = /[^0-9.,]/g;

// Native <input type="number"> only ever accepts "." as the decimal
// separator, regardless of locale, so amount fields use type="text" and
// filter/parse manually to also accept "," (the German-formatted display
// uses "," as the decimal separator).
export function sanitizeAmountInput(value) {
	return String(value ?? "").replace(DISALLOWED_CHARS, "");
}

export function parseAmount(value) {
	if (value === "" || value === null || value === undefined) {
		return null;
	}
	return Number(String(value).replace(",", "."));
}
