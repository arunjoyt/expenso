import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";
import fs from "fs";
import crypto from "crypto";

// nginx serves expenso/public/manifest/* with a 1-year Cache-Control, and
// their filenames never change between releases — so a changed icon needs a
// changed URL to ever reach users. Appending a content hash as a query
// string does that automatically, with no manual version bump to remember.
function iconUrl(filename) {
	const filePath = path.resolve(__dirname, "../expenso/public/manifest", filename);
	const hash = crypto
		.createHash("md5")
		.update(fs.readFileSync(filePath))
		.digest("hex")
		.slice(0, 8);
	return `/assets/expenso/manifest/${filename}?v=${hash}`;
}

export default defineConfig(async () => {
	const { default: frappeui } = await import("frappe-ui/vite");

	const icon192 = iconUrl("manifest-icon-192.maskable.png");
	const icon512 = iconUrl("manifest-icon-512.maskable.png");
	const appleIcon180 = iconUrl("apple-icon-180.png");

	return {
		plugins: [
			frappeui({
				frontendRoute: "/expenso",
				buildConfig: {
					indexHtmlPath: "../expenso/www/expenso.html",
				},
			}),
			vue(),
			{
				name: "cache-bust-apple-touch-icon",
				transformIndexHtml(html) {
					return html.replace(
						/(rel="apple-touch-icon"\s+href=")[^"]*(")/,
						`$1${appleIcon180}$2`
					);
				},
			},
			VitePWA({
				registerType: "autoUpdate",
				devOptions: {
					enabled: true,
				},
				manifest: {
					display: "standalone",
					name: "Expenso",
					short_name: "Expenso",
					start_url: "/expenso",
					description: "Shared family expense tracker",
					theme_color: "#ffffff",
					icons: [
						{
							src: icon192,
							sizes: "192x192",
							type: "image/png",
							purpose: "any",
						},
						{
							src: icon192,
							sizes: "192x192",
							type: "image/png",
							purpose: "maskable",
						},
						{
							src: icon512,
							sizes: "512x512",
							type: "image/png",
							purpose: "any",
						},
						{
							src: icon512,
							sizes: "512x512",
							type: "image/png",
							purpose: "maskable",
						},
					],
				},
			}),
		],
		resolve: {
			alias: {
				"@": path.resolve(__dirname, "src"),
			},
		},
		test: {
			environment: "jsdom",
			globals: true,
			// Scoped to the unit-test directory so Playwright specs under e2e/
			// (visual regression, run via `yarn test:visual`) never get picked
			// up here — they need a real bench site, not jsdom.
			include: ["tests/**/*.test.js"],
			server: {
				deps: {
					inline: ["frappe-ui"],
				},
			},
		},
	};
});
