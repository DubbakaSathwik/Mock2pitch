import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

export default tseslint.config(
  { ignores: [".next/**", "node_modules/**", "supabase/functions/*/index.ts", "next-env.d.ts", "types/database.ts"] },
  { languageOptions: { globals: { ...globals.node, ...globals.browser } } },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { rules: { "@typescript-eslint/no-explicit-any": "off", "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }] } },
);
