import type { Category } from "@/lib/finance-api";

/** Category name with its color as a small dot (the name carries the meaning, not the color). */
export function CategoryChip({ category }: { category: Category | undefined }) {
  if (!category) {
    return <span className="text-muted text-xs font-semibold">Sin categoría</span>;
  }
  return (
    <span className="bg-canvas inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold whitespace-nowrap">
      {/* SVG fill attribute, not an inline style, so the strict CSP allows it */}
      <svg aria-hidden="true" viewBox="0 0 10 10" className="size-2.5 shrink-0">
        <circle cx="5" cy="5" r="5" fill={category.color} />
      </svg>
      {category.name}
    </span>
  );
}
