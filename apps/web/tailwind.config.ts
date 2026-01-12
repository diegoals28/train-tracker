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
        brand: {
          orange: '#ee682a',
          'orange-dark': '#d55a1f',
          green: '#2dba7d',
          'green-dark': '#259668',
        },
      },
    },
  },
  plugins: [],
};

export default config;
