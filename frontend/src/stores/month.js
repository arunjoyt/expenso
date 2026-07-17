import { defineStore } from "pinia";

const MONTH_NAMES = [
	"January",
	"February",
	"March",
	"April",
	"May",
	"June",
	"July",
	"August",
	"September",
	"October",
	"November",
	"December",
];

export const useMonthStore = defineStore("month", {
	state: () => {
		const now = new Date();
		return {
			month: now.getMonth() + 1,
			year: now.getFullYear(),
		};
	},
	getters: {
		label(state) {
			return `${MONTH_NAMES[state.month - 1]} ${state.year}`;
		},
	},
	actions: {
		prevMonth() {
			if (this.month === 1) {
				this.month = 12;
				this.year -= 1;
			} else {
				this.month -= 1;
			}
		},
		nextMonth() {
			if (this.month === 12) {
				this.month = 1;
				this.year += 1;
			} else {
				this.month += 1;
			}
		},
	},
});
