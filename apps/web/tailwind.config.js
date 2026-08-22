export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#070b14",
          900: "#0b1220",
          800: "#121a2b",
          700: "#1a2438",
        },
        gold: {
          400: "#e2c56b",
          500: "#c9a227",
        },
      },
      fontFamily: {
        sans: ["DM Sans", "system-ui", "sans-serif"],
        serif: ["Fraunces", "Georgia", "serif"],
      },
    },
  },
  plugins: [],
};
