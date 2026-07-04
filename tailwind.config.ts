import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#121614",
        foreground: "#E0E6E3",
        muted: "#7A8A82",
        border: "#232B27",
        primary: {
          DEFAULT: "#3CD070",
          foreground: "#121614",
        },
      },
      borderRadius: {
        sm: "0.125rem",
        DEFAULT: "0.125rem",
        md: "0.125rem",
        lg: "0.125rem",
        xl: "0.125rem",
      },
      fontFamily: {
        sans: [
          "var(--font-ui)",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          '"Liberation Mono"',
          "monospace",
        ],
        mono: [
          "var(--font-ui)",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          '"Liberation Mono"',
          "monospace",
        ],
      },
      keyframes: {
        pulseDot: {
          "0%, 100%": { opacity: "0.45", transform: "scale(0.95)" },
          "50%": { opacity: "1", transform: "scale(1)" },
        },
      },
      animation: {
        "pulse-dot": "pulseDot 1.6s ease-in-out infinite",
      },
    },
  },
  plugins: [tailwindcssAnimate],
};

export default config;
