import focacciaFallback from "@/assets/gallery/10-corn-olive-focaccia.webp";
import croissantFallback from "@/assets/gallery/01-croissant.webp";
import painFallback from "@/assets/gallery/12-pain-au-chocolat.webp";
import mushroomFallback from "@/assets/gallery/07-mushroom-onion-focaccia.webp";
import sourdoughFallback from "@/assets/gallery/04-sourdough.webp";

export type ItemImage = { src: string };

// Product photos dropped into src/assets/products/ (e.g. croissant.webp) override the gallery fallbacks.
const productPhotos = import.meta.glob<string>("@/assets/products/*.{png,jpg,jpeg,webp}", {
  eager: true,
  import: "default",
});
const productPhoto = (slug: string, fallback: string): ItemImage => {
  const src = Object.entries(productPhotos).find(([path]) => path.split("/").pop()?.replace(/\.\w+$/, "") === slug)?.[1];
  return { src: src ?? fallback };
};

const focacciaAsset = productPhoto("olive-focaccia", focacciaFallback);
const croissantAsset = productPhoto("croissant", croissantFallback);
const painAsset = productPhoto("pain-au-chocolat", painFallback);
const mushroomAsset = productPhoto("mushroom-focaccia", mushroomFallback);
const sourdoughAsset = productPhoto("sourdough", sourdoughFallback);
const genericAsset: ItemImage = { src: "https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=400&q=80&auto=format&fit=crop" };

export const defaultItemImage = (name: string): ItemImage => {
  const n = name.toLowerCase();
  if (n.includes("sourdough")) return sourdoughAsset;
  if (n.includes("mushroom")) return mushroomAsset;
  if (n.includes("focaccia")) return focacciaAsset;
  if (n.includes("chocolat")) return painAsset;
  if (n.includes("croissant")) return croissantAsset;
  return genericAsset;
};

// An admin-uploaded photo wins over the built-in fallbacks.
export const itemImage = (name: string, imageUrl?: string | null): ItemImage =>
  imageUrl ? { src: imageUrl } : defaultItemImage(name);
