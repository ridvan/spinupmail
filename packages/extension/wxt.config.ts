import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "wxt";

const EXTENSION_NAME = "SpinupMail";

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  manifest: env => ({
    name: EXTENSION_NAME,
    description:
      "Create disposable addresses, read incoming mail, and get new email notifications from SpinupMail.",
    permissions: ["alarms", "identity", "notifications", "storage"],
    host_permissions: [
      "https://api.spinupmail.com/*",
      "http://localhost:8787/*",
      "http://127.0.0.1:8787/*",
    ],
    ...(env.browser === "firefox"
      ? {
          optional_permissions: ["https://*/*", "http://*/*"],
        }
      : {
          optional_host_permissions: ["https://*/*", "http://*/*"],
        }),
    action: {
      default_title: EXTENSION_NAME,
    },
    icons: {
      16: "/icon.png",
      32: "/icon.png",
      48: "/icon.png",
      128: "/icon.png",
    },
    browser_specific_settings: {
      gecko: {
        id: "extension@spinupmail.com",
        strict_min_version: "127.0",
      },
    },
  }),
  vite: () => ({
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./"),
      },
    },
  }),
});
