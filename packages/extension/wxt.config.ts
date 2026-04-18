import path from "node:path";
import { config as loadDotenv } from "dotenv";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "wxt";

loadDotenv({
  path: path.resolve(__dirname, ".env.local"),
});

const EXTENSION_NAME = "SpinupMail";
const CHROMIUM_EXTENSION_KEY =
  process.env.WXT_CHROMIUM_EXTENSION_KEY?.trim() || undefined;

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  manifest: env => {
    const hostPermissions = ["https://api.spinupmail.com/*"];

    if (env.command === "serve") {
      hostPermissions.push(
        "http://localhost:8787/*",
        "http://127.0.0.1:8787/*"
      );
    }

    return {
      name: EXTENSION_NAME,
      description:
        "Create disposable addresses, read incoming mail, and get new email notifications from SpinupMail.",
      permissions: ["alarms", "identity", "notifications", "storage"],
      host_permissions: hostPermissions,
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
      ...(env.browser !== "firefox" && CHROMIUM_EXTENSION_KEY
        ? {
            key: CHROMIUM_EXTENSION_KEY,
          }
        : {}),
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
    };
  },
  vite: () => ({
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./"),
      },
    },
  }),
});
