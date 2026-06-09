import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Terminal / "Operator" palette
        ink: "#0a0c0a",
        panel: "#0f1410",
        panel2: "#121a13",
        line: "#1e2a1f",
        acid: "#7CFF6B",
        acidDim: "#4a8f43",
        muted: "#6b7a6c",
        ghost: "#9fb0a0",
      },
      fontFamily: {
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Consolas",
          "'Liberation Mono'",
          "monospace",
        ],
      },
    },
  },
  plugins: [],
};

export default config;
