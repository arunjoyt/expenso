import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

export default defineConfig(async () => {
	const { default: frappeui } = await import("frappe-ui/vite");

	return {
		plugins: [
			frappeui({
				frontendRoute: "/expenso",
				buildConfig: {
					indexHtmlPath: "../expenso/www/expenso.html",
				},
			}),
			vue(),
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
							src: "/assets/expenso/manifest/manifest-icon-192.maskable.png",
							sizes: "192x192",
							type: "image/png",
							purpose: "any",
						},
						{
							src: "/assets/expenso/manifest/manifest-icon-192.maskable.png",
							sizes: "192x192",
							type: "image/png",
							purpose: "maskable",
						},
						{
							src: "/assets/expenso/manifest/manifest-icon-512.maskable.png",
							sizes: "512x512",
							type: "image/png",
							purpose: "any",
						},
						{
							src: "/assets/expenso/manifest/manifest-icon-512.maskable.png",
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
			server: {
				deps: {
					inline: ["frappe-ui"],
				},
			},
		},
	};
});
