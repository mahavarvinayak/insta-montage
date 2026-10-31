import type { Config } from "tailwindcss";
export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: { extend: {
    colors: {
      background: "hsl(var(--background))", foreground: "hsl(var(--foreground))",
      card: "hsl(var(--card))", muted: "hsl(var(--muted))", "muted-foreground": "hsl(var(--muted-foreground))",
      border: "hsl(var(--border))", primary: "hsl(var(--primary))", "primary-foreground": "hsl(var(--primary-foreground))",
      success: "hsl(var(--success))", warning: "hsl(var(--warning))", destructive: "hsl(var(--destructive))",
    },
    fontFamily: { sans: ["var(--font-sans)", "system-ui", "sans-serif"] },
    borderRadius: { lg: "10px", md: "8px", sm: "6px" },
  } },
} satisfies Config;
