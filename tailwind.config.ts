import type { Config } from "tailwindcss";

/**
 * Visual language of the «إدراك» interface design: deep indigo for actions and the
 * active state, navy text, slate-blue secondary text, a pale blue-grey page with
 * white, borderless, rounded cards, and soft tinted badges / icon circles.
 */
const primary = {
  50: "#EEF3FF",
  100: "#E0EBFF", // primary-soft
  200: "#C7D3FF",
  300: "#A1A8FA",
  400: "#6F6CF2",
  500: "#4A42EC",
  600: "#2C22E7", // primary
  700: "#2318C2",
  800: "#1C1399",
  900: "#150F70",
};

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"IBM Plex Sans Arabic"', "system-ui", "sans-serif"],
      },
      colors: {
        primary,
        blue: primary,
        // Slate-blue greys: #F4F7FB page, #EBF1F8 muted fill, #DFE5ED lines,
        // #7786A5 secondary text, #26325E main text
        gray: {
          50: "#F4F7FB",
          100: "#EBF1F8",
          200: "#E7ECF2",
          300: "#DFE5ED",
          400: "#959FB2",
          500: "#7786A5",
          600: "#5A6889",
          700: "#3E4A72",
          800: "#26325E",
          900: "#1E2850",
        },
        // Semantic tints (soft background + strong foreground)
        green: { 50: "#ECFDF4", 100: "#D3F9E3", 200: "#A6F0C7", 500: "#00C47F", 600: "#00B474", 700: "#00995F", 800: "#007D4E" },
        red: { 50: "#FFF1F1", 100: "#FFE4E4", 200: "#FFC5CC", 500: "#F43A57", 600: "#F43A57", 700: "#DD2443", 800: "#B81C37" },
        amber: { 50: "#FFF8E6", 100: "#FFEEC5", 200: "#FFDF94", 500: "#F7A224", 600: "#E58F0E", 700: "#C2740A", 800: "#9A5B06", 900: "#7A4704" },
        yellow: { 50: "#FFF8E6", 100: "#FFEEC5", 200: "#FFDF94", 600: "#E58F0E", 700: "#C2740A", 800: "#9A5B06" },
        cyan: { 50: "#EAFBFF", 100: "#D2F5FF", 500: "#00B1DA", 600: "#0098BD", 700: "#007A99" },
      },
      borderRadius: {
        card: "1.25rem",
      },
      boxShadow: {
        card: "0 4px 24px -12px rgba(38, 50, 94, 0.18)",
        soft: "0 4px 24px -12px rgba(38, 50, 94, 0.18)",
      },
      backgroundImage: {
        "gradient-primary": "linear-gradient(135deg, #2D45EE, #3000BD)",
      },
    },
  },
  plugins: [],
};

export default config;
