import { cloudflare } from "@cloudflare/vite-plugin";
import react from "@vitejs/plugin-react";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig({
	plugins: [
		tsConfigPaths({ projects: ["./tsconfig.json"] }),
		cloudflare({ viteEnvironment: { name: "ssr" } }),
		tanstackStart(),
		react(),
		tailwindcss(),
	],
	optimizeDeps: {
		exclude: [
			"@tanstack/start-server-core",
			"@tanstack/start-client-core",
			"@tanstack/react-start",
			"@tanstack/react-start/client",
			"@tanstack/react-start/server",
		],
	},
});
