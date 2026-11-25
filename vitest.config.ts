import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // "server-only" lança erro fora do bundler do Next; nos testes é inofensivo.
      "server-only": fileURLToPath(new URL("./tests/stubs/server-only.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Os testes de integração compartilham o mesmo banco: rodar arquivos em série
    // evita que a limpeza de um interfira no outro.
    fileParallelism: false,
  },
});
