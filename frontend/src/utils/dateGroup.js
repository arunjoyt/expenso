function parseISODate(dateStr) {
	const [year, month, day] = dateStr.split("-").map(Number);
	return new Date(year, month - 1, day);
}

function stripTime(date) {
	return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function dateGroupLabel(dateStr, today = new Date()) {
	const date = stripTime(parseISODate(dateStr));
	const reference = stripTime(today);
	const diffDays = Math.round((reference - date) / 86400000);

	if (diffDays === 0) return "Today";
	if (diffDays === 1) return "Yesterday";

	return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
