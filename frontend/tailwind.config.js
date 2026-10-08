/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cyber: {
          bg: "#0B0F19",
          card: "rgba(17, 24, 39, 0.7)",
          border: "rgba(255, 255, 255, 0.08)",
          primary: "#3B82F6",    // Neon Blue
          secondary: "#10B981",  // Emerald Green
          accent: "#8B5CF6",     // Violet/Purple
          darkaccent: "#4F46E5", // Indigo
        }
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        glass: "0 8px 32px 0 rgba(0, 0, 0, 0.37)",
        "glass-emerald": "0 8px 32px 0 rgba(16, 185, 129, 0.15)",
        "glass-red": "0 8px 32px 0 rgba(239, 68, 68, 0.15)",
        "glass-blue": "0 8px 32px 0 rgba(59, 130, 246, 0.15)",
      },
      backdropBlur: {
        glass: "12px",
      }
    },
  },
  plugins: [],
}
