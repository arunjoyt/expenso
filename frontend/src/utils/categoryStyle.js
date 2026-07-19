// frappe-ui's Tailwind preset replaces the default color palette with its own
// curated set — "emerald", "rose", "sky", "fuchsia", and plain "indigo" aren't
// part of it and silently compile to nothing. Stick to hues confirmed present
// (gray, red, orange, amber, yellow, green, teal, cyan, blue, violet, purple, pink).
const PALETTE = [
	{ emoji: "🍔", bg: "bg-orange-100", ring: "bg-orange-400" },
	{ emoji: "🚗", bg: "bg-blue-100", ring: "bg-blue-400" },
	{ emoji: "🛍️", bg: "bg-pink-100", ring: "bg-pink-400" },
	{ emoji: "🏠", bg: "bg-amber-100", ring: "bg-amber-400" },
	{ emoji: "🎬", bg: "bg-purple-100", ring: "bg-purple-400" },
	{ emoji: "💊", bg: "bg-green-100", ring: "bg-green-400" },
	{ emoji: "📚", bg: "bg-cyan-100", ring: "bg-cyan-400" },
	{ emoji: "✈️", bg: "bg-teal-100", ring: "bg-teal-400" },
	{ emoji: "🎁", bg: "bg-red-100", ring: "bg-red-400" },
	{ emoji: "☕", bg: "bg-yellow-100", ring: "bg-yellow-500" },
	{ emoji: "⚡", bg: "bg-violet-100", ring: "bg-violet-400" },
	{ emoji: "🐾", bg: "bg-gray-100", ring: "bg-gray-400" },
];

const UNCATEGORIZED = { emoji: "📦", bg: "bg-gray-100", ring: "bg-gray-400" };

// Hand-picked matches for the default Categories seeded on every Family
// (see expenso/expenso/doctype/family/family.py DEFAULT_CATEGORIES) and their
// Income-side Source counterparts, so the common cases look intentional
// rather than landing on an arbitrary hash bucket.
const NAMED = {
	groceries: { emoji: "🛒", bg: "bg-green-100", ring: "bg-green-400" },
	dining: { emoji: "🍔", bg: "bg-orange-100", ring: "bg-orange-400" },
	transport: { emoji: "🚗", bg: "bg-blue-100", ring: "bg-blue-400" },
	utilities: { emoji: "💡", bg: "bg-amber-100", ring: "bg-amber-400" },
	health: { emoji: "💊", bg: "bg-red-100", ring: "bg-red-400" },
	entertainment: { emoji: "🎬", bg: "bg-purple-100", ring: "bg-purple-400" },
	shopping: { emoji: "🛍️", bg: "bg-pink-100", ring: "bg-pink-400" },
	other: { emoji: "🔖", bg: "bg-gray-100", ring: "bg-gray-400" },
};

function hash(str) {
	let h = 0;
	for (let i = 0; i < str.length; i++) {
		h = (h * 31 + str.charCodeAt(i)) >>> 0;
	}
	return h;
}

export function getCategoryVisual(name) {
	if (!name || name === "Uncategorized") return UNCATEGORIZED;
	const named = NAMED[name.trim().toLowerCase()];
	if (named) return named;
	return PALETTE[hash(name) % PALETTE.length];
}
