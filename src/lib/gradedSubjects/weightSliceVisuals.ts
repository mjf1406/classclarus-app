import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";

import { faBugs } from "@/components/icons/fa-packs/solid/b";
import { faCat, faCow, faCrow } from "@/components/icons/fa-packs/solid/c";
import { faDog, faDove, faDragon } from "@/components/icons/fa-packs/solid/d";
import { faFish, faFrog } from "@/components/icons/fa-packs/solid/f";
import { faHippo, faHorse } from "@/components/icons/fa-packs/solid/h";
import { faKiwiBird } from "@/components/icons/fa-packs/solid/k";
import { faLocust } from "@/components/icons/fa-packs/solid/l";
import { faMosquito } from "@/components/icons/fa-packs/solid/m";
import { faOtter } from "@/components/icons/fa-packs/solid/o";
import { faPaw } from "@/components/icons/fa-packs/solid/p";
import { faShrimp, faSpider } from "@/components/icons/fa-packs/solid/s";
import { faWorm } from "@/components/icons/fa-packs/solid/w";

import { PIE_CHART_COLORS } from "./gradedSubjects";

export type WeightSliceVisual = {
  color: string;
  icon: IconDefinition;
  iconId: string;
};

type AnimalEntry = {
  id: string;
  icon: IconDefinition;
};

const WEIGHT_SLICE_ANIMALS: AnimalEntry[] = [
  { id: "cat", icon: faCat },
  { id: "dog", icon: faDog },
  { id: "frog", icon: faFrog },
  { id: "hippo", icon: faHippo },
  { id: "otter", icon: faOtter },
  { id: "spider", icon: faSpider },
  { id: "crow", icon: faCrow },
  { id: "fish", icon: faFish },
  { id: "dove", icon: faDove },
  { id: "dragon", icon: faDragon },
  { id: "horse", icon: faHorse },
  { id: "cow", icon: faCow },
  { id: "shrimp", icon: faShrimp },
  { id: "kiwi-bird", icon: faKiwiBird },
  { id: "locust", icon: faLocust },
  { id: "mosquito", icon: faMosquito },
  { id: "worm", icon: faWorm },
  { id: "bugs", icon: faBugs },
  { id: "paw", icon: faPaw },
];

function hashString(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function combineSeed(keys: readonly string[]): number {
  return keys.reduce((acc, key) => acc ^ hashString(key), 5381);
}

function seededShuffle<T>(items: readonly T[], seed: number): T[] {
  const arr = [...items];
  let s = seed >>> 0;
  for (let i = arr.length - 1; i > 0; i--) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    const j = s % (i + 1);
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

/** Stable animal + color per item key; unique animals until the pool wraps. */
export function assignWeightSliceVisuals(
  itemKeysInOrder: readonly string[],
): Map<string, WeightSliceVisual> {
  const sortedKeys = [...new Set(itemKeysInOrder)].sort();
  const seed = combineSeed(sortedKeys);
  const shuffled = seededShuffle(WEIGHT_SLICE_ANIMALS, seed);

  const animalByKey = new Map<string, AnimalEntry>();
  for (const [index, key] of sortedKeys.entries()) {
    animalByKey.set(key, shuffled[index % shuffled.length]!);
  }

  const result = new Map<string, WeightSliceVisual>();
  for (const [index, key] of itemKeysInOrder.entries()) {
    const animal = animalByKey.get(key)!;
    result.set(key, {
      color: PIE_CHART_COLORS[index % PIE_CHART_COLORS.length]!,
      icon: animal.icon,
      iconId: animal.id,
    });
  }
  return result;
}

export function weightSliceVisual(
  itemKey: string,
  index: number,
  allItemKeys: readonly string[],
): WeightSliceVisual {
  return (
    assignWeightSliceVisuals(allItemKeys).get(itemKey) ?? {
      color: PIE_CHART_COLORS[index % PIE_CHART_COLORS.length]!,
      icon: WEIGHT_SLICE_ANIMALS[0]!.icon,
      iconId: WEIGHT_SLICE_ANIMALS[0]!.id,
    }
  );
}
