import { defineConfig, Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";

const fullReloadAlways: Plugin = {
    name: "full-reload",
    handleHotUpdate({ server }) {
        server.ws.send({ type: "full-reload" });
        return [];
    },
};

// https://vite.dev/config/
export default defineConfig({
    plugins: [react(), fullReloadAlways],
});
