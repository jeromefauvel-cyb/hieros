import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#000000",
        foreground: "#00FF00",
        accent: "#FF8C00",
        white: "#FFFFFF",
      },
      fontFamily: {
        terminal: ['"Courier New"', "Courier", "monospace"],
        marsek: ["var(--font-marsek)", '"Courier New"', "monospace"],
      },
      borderColor: {
        hud: "#00FF00",
      },
    },
  },
  plugins: [],
};
export default config;
