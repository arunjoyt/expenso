import { defineConfig, devices } from "@playwright/test";

// Visual regression against a real, already-running bench site — the app
// needs live Frappe auth/API responses, not just static files, so this does
// NOT spin up its own server. Build the frontend (`yarn build`) and clear the
// bench cache first, with the site already running, then:
//   yarn test:visual            # compare against committed baselines
//   yarn test:visual:update     # regenerate baselines after an intentional UI change
// Point at a different site with EXPENSO_TEST_URL=http://host:port/expenso
export default defineConfig({
	testDir: "./e2e",
	fullyParallel: false,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	workers: 1,
	reporter: [["list"], ["html", { open: "never" }]],
	use: {
		// Trailing slash matters: goto("login") (no leading slash) resolves
		// relative to this. A leading slash in the spec would instead resolve
		// against the origin root and drop the /expenso prefix entirely.
		baseURL: process.env.EXPENSO_TEST_URL || "http://127.0.0.1:8005/expenso/",
		trace: "retain-on-failure",
		viewport: { width: 420, height: 900 },
	},
	expect: {
		toHaveScreenshot: {
			// Default threshold (0.2 per-pixel color sensitivity) is tuned for
			// photographs and misses subtle pastel-vs-pastel background shifts
			// entirely — exactly the kind of change this app has been iterating
			// on. Tightened so those register while still tolerating normal
			// font anti-aliasing noise at text/icon edges.
			threshold: 0.05,
			maxDiffPixelRatio: 0.02,
			animations: "disabled",
		},
	},
	projects: [
		{
			name: "chromium",
			use: { ...devices["Desktop Chrome"] },
		},
	],
});
