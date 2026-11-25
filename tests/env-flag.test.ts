import { describe, expect, it } from "vitest";
import { parseBooleanFlag } from "@/lib/env";

describe("parseBooleanFlag (SALES_ENABLED)", () => {
  it.each(["true", "True", " TRUE ", '"true"', "'true'", "1"])("%j liga as vendas", (v) => {
    expect(parseBooleanFlag(v)).toBe(true);
  });
  it.each([undefined, "", "false", "no", "verdadeiro", "0"])("%j mantém desligado", (v) => {
    expect(parseBooleanFlag(v)).toBe(false);
  });
});
