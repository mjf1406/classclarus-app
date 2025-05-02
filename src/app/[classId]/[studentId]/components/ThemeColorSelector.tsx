"use client";

import React, { useState, useEffect, type JSX } from "react";
import { useTheme } from "next-themes";
import { ShadcnColorPicker } from "@/components/ShadcnColorPicker";

/* ---------------- Helper Functions ---------------- */

function hexToHSL(hex: string): { h: number; s: number; l: number } {
  const normalizedHex = hex.replace("#", "");
  const r = parseInt(normalizedHex.substring(0, 2), 16) / 255;
  const g = parseInt(normalizedHex.substring(2, 4), 16) / 255;
  const b = parseInt(normalizedHex.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h: number, s: number;
  const l = (max + min) / 2;

  if (max === min) {
    h = 0;
    s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) {
      h = (g - b) / d + (g < b ? 6 : 0);
    } else if (max === g) {
      h = (b - r) / d + 2;
    } else {
      h = (r - g) / d + 4;
    }
    h *= 60;
  }
  return { h, s, l };
}

function hslToHex(h: number, s: number, l: number): string {
  const H = h / 360;
  let r: number, g: number, b: number;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number): number => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;

    r = hue2rgb(p, q, H + 1 / 3);
    g = hue2rgb(p, q, H);
    b = hue2rgb(p, q, H - 1 / 3);
  }

  const toHex = (x: number): string => {
    const hexPart = Math.round(x * 255).toString(16);
    return hexPart.length === 1 ? "0" + hexPart : hexPart;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

function rotateHue(h: number, deg: number): number {
  return (h + deg + 360) % 360;
}

function getContrastColor(hex: string): string {
  const normalized =
    hex.startsWith("#") && hex.length >= 7 ? hex.slice(1) : hex;
  const r = parseInt(normalized.substr(0, 2), 16);
  const g = parseInt(normalized.substr(2, 2), 16);
  const b = parseInt(normalized.substr(4, 2), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 128 ? "#000000" : "#FFFFFF";
}

/* ---------------- Palette Generators ---------------- */

export type Palette = Record<string, string>;

export function generatePalette(primaryHex: string): Palette {
  const baseHSL = hexToHSL(primaryHex);
  const { h: baseHue, s: baseSat, l: baseLight } = baseHSL;
  const palette: Palette = {};

  palette["--primary"] = primaryHex;
  palette["--primary-foreground"] = getContrastColor(primaryHex);
  palette["--secondary"] = hslToHex(rotateHue(baseHue, 90), baseSat, baseLight);
  palette["--secondary-foreground"] = getContrastColor(palette["--secondary"]);
  palette["--accent"] = hslToHex(rotateHue(baseHue, 40), baseSat, baseLight);
  palette["--accent-foreground"] = getContrastColor(palette["--accent"]);
  palette["--destructive"] = hslToHex(30, baseSat, baseLight);
  palette["--destructive-foreground"] = getContrastColor(
    palette["--destructive"],
  );
  palette["--info"] = hslToHex(rotateHue(baseHue, -40), baseSat, baseLight);
  palette["--info-foreground"] = getContrastColor(palette["--info"]);
  palette["--warning"] = hslToHex(rotateHue(baseHue, 180), baseSat, baseLight);
  palette["--warning-foreground"] = getContrastColor(palette["--warning"]);
  palette["--background"] = hslToHex(baseHue, 0.02, 0.98);
  palette["--foreground"] = hslToHex(baseHue, 0.01, 0.15);
  palette["--card"] = hslToHex(baseHue, Math.max(0.1, baseSat * 0.3), 0.92);
  palette["--card-foreground"] = palette["--foreground"];
  palette["--popover"] = hslToHex(baseHue, 0.01, 0.96);
  palette["--popover-foreground"] = palette["--foreground"];
  palette["--border"] = hslToHex(baseHue, 0.005, 0.85);
  palette["--input"] = palette["--border"];
  palette["--ring"] = palette["--primary"];
  palette["--chart-1"] = palette["--primary"];
  palette["--chart-2"] = palette["--secondary"];
  palette["--chart-3"] = hslToHex(70, baseSat, baseLight);
  palette["--chart-4"] = hslToHex(150, baseSat, baseLight);
  palette["--chart-5"] = palette["--accent"];
  palette["--sidebar"] = hslToHex(baseHue, 0.01, 0.96);
  palette["--sidebar-foreground"] = palette["--foreground"];
  palette["--sidebar-primary"] = palette["--primary"];
  palette["--sidebar-primary-foreground"] = palette["--primary-foreground"];
  palette["--sidebar-accent"] = palette["--accent"];
  palette["--sidebar-accent-foreground"] = palette["--accent-foreground"];
  palette["--sidebar-border"] = palette["--border"];
  palette["--sidebar-ring"] = palette["--ring"];
  palette["--muted"] = hslToHex(baseHue, 0.005, 0.93);
  palette["--muted-foreground"] = hslToHex(baseHue, 0.01, 0.35);

  return palette;
}

export function generateDarkPalette(primaryHex: string): Palette {
  const baseHSL = hexToHSL(primaryHex);
  const { h: baseHue, s: baseSat, l: baseLight } = baseHSL;
  const dark: Palette = {};

  dark["--primary"] = hslToHex(baseHue, baseSat, Math.max(0, baseLight - 0.1));
  dark["--primary-foreground"] = getContrastColor(dark["--primary"]);
  dark["--secondary"] = hslToHex(
    rotateHue(baseHue, 90),
    baseSat,
    Math.max(0, baseLight - 0.1),
  );
  dark["--secondary-foreground"] = getContrastColor(dark["--secondary"]);
  dark["--accent"] = hslToHex(
    rotateHue(baseHue, 40),
    baseSat,
    Math.max(0, baseLight - 0.1),
  );
  dark["--accent-foreground"] = getContrastColor(dark["--accent"]);
  dark["--destructive"] = hslToHex(30, baseSat, Math.max(0, baseLight - 0.1));
  dark["--destructive-foreground"] = getContrastColor(dark["--destructive"]);
  dark["--info"] = hslToHex(
    rotateHue(baseHue, -40),
    baseSat,
    Math.max(0, baseLight - 0.1),
  );
  dark["--info-foreground"] = getContrastColor(dark["--info"]);
  dark["--warning"] = hslToHex(
    rotateHue(baseHue, 180),
    baseSat,
    Math.max(0, baseLight - 0.1),
  );
  dark["--warning-foreground"] = getContrastColor(dark["--warning"]);
  dark["--background"] = "#000000";
  dark["--foreground"] = hslToHex(baseHue, 0.01, 0.98);
  dark["--card"] = hslToHex(baseHue, Math.max(0.1, baseSat * 0.3), 0.24);
  dark["--card-foreground"] = dark["--foreground"];
  dark["--popover"] = hslToHex(baseHue, 0.01, 0.24);
  dark["--popover-foreground"] = dark["--foreground"];
  dark["--border"] = hslToHex(baseHue, 0.005, 0.3);
  dark["--input"] = dark["--border"];
  dark["--ring"] = dark["--primary"];
  dark["--chart-1"] = dark["--primary"];
  dark["--chart-2"] = dark["--secondary"];
  dark["--chart-3"] = hslToHex(70, baseSat, Math.max(0, baseLight - 0.1));
  dark["--chart-4"] = hslToHex(150, baseSat, Math.max(0, baseLight - 0.1));
  dark["--chart-5"] = dark["--accent"];
  dark["--sidebar"] = hslToHex(baseHue, 0.01, 0.24);
  dark["--sidebar-foreground"] = dark["--foreground"];
  dark["--sidebar-primary"] = dark["--primary"];
  dark["--sidebar-primary-foreground"] = dark["--primary-foreground"];
  dark["--sidebar-accent"] = dark["--accent"];
  dark["--sidebar-accent-foreground"] = dark["--accent-foreground"];
  dark["--sidebar-border"] = dark["--border"];
  dark["--sidebar-ring"] = dark["--ring"];
  dark["--muted"] = hslToHex(baseHue, 0.005, 0.2);
  dark["--muted-foreground"] = hslToHex(baseHue, 0.01, 0.8);

  return dark;
}

/**
 * Injects or updates a <style> tag with id "dark-theme-vars"
 * in the document head, stashing the dark-mode CSS variables
 * inside a `.dark { … }` rule.
 */
function updateDarkStyle(darkPalette: Palette): void {
  let darkVars = "";
  for (const [key, value] of Object.entries(darkPalette)) {
    darkVars += `${key}: ${value}; `;
  }
  let styleTag = document.getElementById("dark-theme-vars");
  if (!styleTag) {
    styleTag = document.createElement("style");
    styleTag.id = "dark-theme-vars";
    document.head.appendChild(styleTag);
  }
  // This rule applies globally when the "dark" class is set.
  styleTag.innerHTML = `.dark { ${darkVars} }`;
}

export default function ThemeColorSelector(): JSX.Element {
  const { theme } = useTheme();
  const [primaryColor, setPrimaryColor] = useState<string>("#3B82F6");

  // Update the inline CSS variables based on both the primaryColor and theme
  useEffect(() => {
    if (theme === "dark") {
      const darkPalette = generateDarkPalette(primaryColor);
      Object.entries(darkPalette).forEach(([key, value]) => {
        document.documentElement.style.setProperty(key, value);
      });
    } else {
      const lightPalette = generatePalette(primaryColor);
      Object.entries(lightPalette).forEach(([key, value]) => {
        document.documentElement.style.setProperty(key, value);
      });
    }
  }, [theme, primaryColor]);

  const handleChange = (newColor: string): void => {
    setPrimaryColor(newColor);
  };

  return (
    <div className="w-full">
      <ShadcnColorPicker value={primaryColor} onChange={handleChange} />
    </div>
  );
}
