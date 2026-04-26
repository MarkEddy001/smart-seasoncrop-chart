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
	optimizeDeps: {
		exclude: [
			"@tanstack/react-start",
			"@tanstack/react-start/server-entry",
			"@tanstack/start-server-core",
		],
	},
});
