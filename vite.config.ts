import { cloudflare } from "@cloudflare/vite-plugin";
import react from "@vitejs/plugin-react";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig({
	plugins: [
		tsConfigPaths({ projects: ["./tsconfig.json"] }),
		tanstackStart(),
		react(),
		tailwindcss(),
		cloudflare(),
	],
	// TanStack Start virtual modules are provided by the tanstackStart() plugin
	// at runtime — exclude them from Vite's dep optimizer so esbuild doesn't try
	// to resolve them ahead of time. Fixes TanStack/router#4285 with the
	// Cloudflare Workers Vite plugin.
	optimizeDeps: {
		exclude: [
			"@tanstack/react-start",
			"@tanstack/start-server-core",
			"@tanstack/react-start-server",
			"@tanstack/react-start-client",
			"tanstack-start-manifest:v",
			"tanstack-start-injected-head-scripts:v",
			"tanstack-start-server-fn-manifest:v",
			"tanstack-start-route-tree:v",
			"#tanstack-router-entry",
			"#tanstack-start-entry",
			"#tanstack-start-plugin-adapters",
		],
	},
});
