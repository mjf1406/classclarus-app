"use client";

import React, { useEffect, useState } from "react";
import { useLocalStorage } from "@uidotdev/usehooks";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { IconName, IconPrefix } from "@fortawesome/fontawesome-svg-core";

// We extend our PositionStyle with an optional 'side' field
interface PositionStyle {
  top?: string;
  bottom?: string;
  left?: string;
  right?: string;
  transform: string;
  fontSize: string;
  side?: "left" | "right" | "bottom";
}

interface SelectedIcon {
  name: IconName;
  prefix: IconPrefix;
}

const StudentIconDecoration: React.FC = () => {
  // Retrieve the selected icon from localStorage.
  const [selectedIcon] = useLocalStorage<SelectedIcon | null>(
    "selectedIcon",
    null,
  );

  // Instead of a single style, we create an array of decorations.
  const [styles, setStyles] = useState<PositionStyle[]>([]);

  useEffect(() => {
    // Only generate decorations if a selected icon exists and we haven't computed styles yet.
    if (!selectedIcon || styles.length > 0) return;

    const decorationCount = 30; // Number of icons to generate.
    const generatedStyles: PositionStyle[] = [];
    const maxAttempts = 20; // Maximum attempts per decoration to avoid overlap.
    const overlapThreshold = 5; // Minimum gap (in vh or vw) required between decorations.

    // Helper: random number generator between min and max.
    const randomBetween = (min: number, max: number): number =>
      Math.random() * (max - min) + min;

    // Function to check if candidate overlaps with any already-placed decoration on the same side.
    const overlaps = (candidate: PositionStyle): boolean => {
      // Determine which coordinate to compare.
      let candidateCoord: number;
      if (candidate.side === "left" || candidate.side === "right") {
        candidateCoord = parseFloat(candidate.top ?? "0");
      } else if (candidate.side === "bottom") {
        candidateCoord = parseFloat(candidate.left ?? "0");
      } else {
        return false;
      }

      // Check all previously generated decorations on the same side.
      return generatedStyles.some((existing) => {
        if (existing.side !== candidate.side) return false;
        let existingCoord: number;
        if (existing.side === "left" || existing.side === "right") {
          existingCoord = parseFloat(existing.top ?? "0");
        } else {
          existingCoord = parseFloat(existing.left ?? "0");
        }
        return Math.abs(existingCoord - candidateCoord) < overlapThreshold;
      });
    };

    // Generate decorations.
    for (let i = 0; i < decorationCount; i++) {
      let candidate: PositionStyle | null = null;
      let attempts = 0;

      // Try to generate a candidate that doesn't overlap.
      while (attempts < maxAttempts && !candidate) {
        attempts++;

        // Choose one random side: left, right, or bottom.
        const sides: ("left" | "right" | "bottom")[] = [
          "left",
          "right",
          "bottom",
        ];
        const side = sides[Math.floor(Math.random() * sides.length)];

        // Random rotation between -30deg and 30deg.
        const rotation = randomBetween(-30, 30);
        // Random size between 24px and 48px.
        const size = Math.floor(randomBetween(24, 48));

        const newStyle: PositionStyle = {
          fontSize: `${size}px`,
          transform: `rotate(${rotation}deg)`,
          side, // save the side for overlap checking.
        };

        // Place the icon along the chosen edge.
        if (side === "left") {
          newStyle.left = "0px";
          newStyle.top = `${randomBetween(0, 100)}vh`;
        } else if (side === "right") {
          newStyle.right = "0px";
          newStyle.top = `${randomBetween(0, 100)}vh`;
        } else if (side === "bottom") {
          newStyle.bottom = "0px";
          newStyle.left = `${randomBetween(0, 100)}vw`;
        }

        // If candidate doesn't overlap with existing ones, accept it.
        if (!overlaps(newStyle)) {
          candidate = newStyle;
        }
      }

      // If we failed to find a non-overlapping candidate after maxAttempts,
      // push the last candidate regardless.
      if (!candidate) {
        // Generate one candidate without checking overlap.
        const sideOptions: ("left" | "right" | "bottom")[] = [
          "left",
          "right",
          "bottom",
        ];
        const side =
          sideOptions[Math.floor(Math.random() * sideOptions.length)];
        const rotation = randomBetween(-30, 30);
        const size = Math.floor(randomBetween(24, 48));
        candidate = {
          fontSize: `${size}px`,
          transform: `rotate(${rotation}deg)`,
          side,
        };
        if (side === "left") {
          candidate.left = "0px";
          candidate.top = `${randomBetween(0, 100)}vh`;
        } else if (side === "right") {
          candidate.right = "0px";
          candidate.top = `${randomBetween(0, 100)}vh`;
        } else if (side === "bottom") {
          candidate.bottom = "0px";
          candidate.left = `${randomBetween(0, 100)}vw`;
        }
      }

      generatedStyles.push(candidate);
    }

    setStyles(generatedStyles);
  }, [selectedIcon, styles]);

  // If no icon is selected or no decorations are generated, render nothing.
  if (!selectedIcon || styles.length === 0) return null;

  return (
    <>
      {styles.map((style, index) => (
        <div
          key={index}
          style={{
            ...style,
            position: "fixed",
            pointerEvents: "none",
            zIndex: 10,
          }}
          className="text-primary" // Tailwind class for primary color.
        >
          <FontAwesomeIcon icon={[selectedIcon.prefix, selectedIcon.name]} />
        </div>
      ))}
    </>
  );
};

export default StudentIconDecoration;
