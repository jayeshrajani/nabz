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

  it.each(["facility-panel", "alerts-panel"])("gives %s an explicit readable foreground", (panel) => {
    const source = readFileSync(new URL(`../../src/components/facilities/${panel}.tsx`, import.meta.url), "utf8");
    const panelClasses = source.match(/<motion\.section\b[\s\S]*?className="([^"]+)"/)?.[1].split(/\s+/);

    expect(panelClasses).toContain("text-ink");
    expect(panelClasses).not.toContain("text-white");
  });

  it("limits white map text to dark elements rather than the panel ancestor", () => {
    const source = readFileSync(new URL("../../src/components/district-3d/network-stage.tsx", import.meta.url), "utf8");
    const stageClasses = source.match(/<section\b[^>]*className="([^"]+)"/)?.[1].split(/\s+/);

    expect(stageClasses).toBeDefined();
    expect(stageClasses).not.toContain("text-white");
  });
});

describe("assistant entry point", () => {
  it("keeps chat and expansion in the greeting tile without shell launchers", () => {
    const shell = readFileSync(new URL("../../src/components/layout/app-shell.tsx", import.meta.url), "utf8");
    const tile = readFileSync(new URL("../../src/components/facilities/greeting-tile.tsx", import.meta.url), "utf8");

    expect(shell).not.toContain("useAssistant");
    expect(shell).not.toContain('t("nav.ask")');
    expect(tile).toContain("<ChatComposer");
    expect(tile).toContain("setOpen(true)");
  });
});

describe("3D map labels", () => {
  it("does not mount drei Html, whose nested React roots race unmounts", () => {
    const scene = readFileSync(new URL("../../src/components/district-3d/district-network.tsx", import.meta.url), "utf8");

    expect(scene).not.toMatch(/import\s*\{[^}]*\bHtml\b[^}]*\}\s*from\s*"@react-three\/drei"/);
    expect(scene).not.toContain("<Html");
    expect(scene).toContain("LabelProjector");
  });
});