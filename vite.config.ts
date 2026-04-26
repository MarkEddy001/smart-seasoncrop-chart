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
	// Workaround for TanStack/router#4285: TanStack Start's virtual modules
	// (tanstack-start-manifest:v, #tanstack-router-entry, etc.) are provided by
	// the tanstackStart() plugin at runtime. With the Cloudflare Workers Vite
	// plugin, esbuild's dep optimizer tries to resolve them ahead of time and
	// fails. Excluding the entry packages prevents pre-bundling.
	optimizeDeps: {
		exclude: [
			"@tanstack/react-start",
			"@tanstack/start-server-core",
			"@tanstack/react-start-server",
			"@tanstack/react-start-client",
		],
	},
});
