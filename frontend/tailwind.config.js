import frappeUIPreset from "frappe-ui/tailwind";

export default {
	presets: [frappeUIPreset],
	content: [
		"./index.html",
		"./src/**/*.{vue,js,ts,jsx,tsx}",
		"./node_modules/frappe-ui/src/**/*.{vue,js,ts,jsx,tsx}",
		"./node_modules/frappe-ui/frappe/**/*.{vue,js,ts,jsx,tsx}",
	],
	theme: {
		extend: {
			fontFamily: {
				sans: ["Nunito", "ui-sans-serif", "system-ui", "sans-serif"],
			},
			keyframes: {
				"pop-in": {
					"0%": { opacity: "0", transform: "scale(0.92) translateY(4px)" },
					"100%": { opacity: "1", transform: "scale(1) translateY(0)" },
				},
				"sheet-up": {
					"0%": { transform: "translateY(100%)" },
					"100%": { transform: "translateY(0)" },
				},
			},
			animation: {
				"pop-in": "pop-in 0.2s ease-out",
				"sheet-up": "sheet-up 0.25s cubic-bezier(0.32, 0.72, 0, 1)",
			},
			colors: {
				accent: {
					500: "#6366F1",
					600: "#4F46E5",
					700: "#4338CA",
				},
				// frappe-ui's Button theme="blue" reads these tokens directly (see
				// node_modules/frappe-ui/src/components/Button/Button.vue); overriding
				// them to indigo keeps theme="blue" buttons matching the accent color.
				blue: {
					200: "#C7D2FE",
					300: "#A5B4FC",
					400: "#818CF8",
					500: "#4F46E5",
					700: "#3730A3",
				},
				"surface-blue": {
					2: "#E0E7FF",
					3: "#4338CA",
				},
				"ink-blue": {
					3: "#4F46E5",
					link: "#4F46E5",
				},
				"outline-blue": {
					1: "#C7D2FE",
				},
			},
		},
	},
	plugins: [],
};
