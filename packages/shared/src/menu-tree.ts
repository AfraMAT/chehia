import type { Category } from "./types";

/**
 * Category hierarchy — the menu is two levels: top-level categories, each with
 * optional subcategories (a category whose `parent_id` points at it). Shared by
 * the web and mobile menu screens so grouping logic lives in exactly one place.
 */

export interface CategoryNode extends Category {
  /** Subcategories, in sort order. */
  children: Category[];
}

/**
 * Build the top-level → subcategory tree from a flat category list.
 * A category whose parent is absent from the list (e.g. an inactive parent that
 * was filtered out) is treated as top-level so its items never disappear.
 */
export function buildCategoryTree(categories: Category[]): CategoryNode[] {
  const present = new Set(categories.map((c) => c.id));
  const childrenByParent = new Map<string, Category[]>();
  const roots: Category[] = [];

  for (const cat of categories) {
    if (cat.parent_id && present.has(cat.parent_id)) {
      const list = childrenByParent.get(cat.parent_id) ?? [];
      list.push(cat);
      childrenByParent.set(cat.parent_id, list);
    } else {
      roots.push(cat);
    }
  }

  const bySort = (a: Category, b: Category) => a.sort_order - b.sort_order;
  return roots
    .sort(bySort)
    .map((root) => ({ ...root, children: (childrenByParent.get(root.id) ?? []).sort(bySort) }));
}

/** A node's own id plus its subcategories' ids — the categories whose items belong to it. */
export function descendantCategoryIds(node: CategoryNode): string[] {
  return [node.id, ...node.children.map((c) => c.id)];
}

/** Count of items that belong to a node (its own + its subcategories'). */
export function nodeItemCount(node: CategoryNode, itemCountByCategory: Record<string, number>): number {
  return descendantCategoryIds(node).reduce((sum, id) => sum + (itemCountByCategory[id] ?? 0), 0);
}
