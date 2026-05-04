import { activeFlavor } from "./flavor-of-month";
import type { Pastry } from "./types";

/**
 * Default hashtag set for any campaign variant — combines a base brand
 * pack, a viral pack (only on hero pastries), the pastry slug, and any
 * flavor-of-the-month tags when applicable.
 */
export function defaultHashtagsFor(pastry: Pastry): string[] {
  const base = ["#NYCBakery", "#NoHoEats", "#LafayetteNYC", "#FrenchBakery"];
  const viral = ["#InstagramFamous", "#ViralFood", "#NYCEats", "#FoodTok"];
  const slug = pastry.slug.replace(/-/g, "");
  const heroTags = pastry.isHero || pastry.viralIndex >= 60 ? [...base, ...viral] : base;
  const flavor = activeFlavor();
  const flavorTags = flavor && flavor.pastryId === pastry.id ? flavor.recommendedHashtags.slice(0, 4) : [];
  return Array.from(new Set([...heroTags, ...flavorTags, `#${slug}`])).slice(0, 9);
}
