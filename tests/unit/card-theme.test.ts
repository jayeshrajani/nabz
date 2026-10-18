import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("light card theme", () => {
  it("sets its own foreground so dark map text cannot bleed into light panels", () => {
    const stylesheet = readFileSync(new URL("../../src/app/globals.css", import.meta.url), "utf8");
    const card = stylesheet.match(/@utility card\s*\{([^}]+)\}/)?.[1];

    expect(card).toBeDefined();
    expect(card).toMatch(/background:\s*var\(--color-surface\)/);
    expect(card).toMatch(/color:\s*var\(--color-ink\)/);
  });
});