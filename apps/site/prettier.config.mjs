/** @type {import("prettier").Config & import("prettier-plugin-tailwindcss").PluginOptions} */
const config = {
  plugins: ["prettier-plugin-tailwindcss"],
  tailwindStylesheet: "./app/globals.css",
  printWidth: 100,
  trailingComma: "all",
};

export default config;
