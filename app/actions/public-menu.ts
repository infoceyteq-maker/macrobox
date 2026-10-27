"use server";

import { createSupabaseServerClient } from "@/lib/pos/supabase-server";
import { runAction } from "@/lib/pos/action-result";
import { isLocalMode } from "@/lib/pos/config";
import { normalizeDatabaseError } from "@/lib/pos/errors";
import { localGetPublicMenu } from "@/lib/pos/local-db";
import type {
  PublicMenuCategory,
  PublicMenuData,
  PublicMenuProduct,
} from "@/lib/pos/public-menu";
import type { ActionResult } from "@/lib/pos/types";

type ProductRow = {
  id: string;
  title: string;
  category_id: string;
  base_price: number | string;
  is_active: boolean;
};

type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
  is_active: boolean;
};

/** Public active-menu read for the digital catalog and cart. No auth required. */
export async function getPublicMenuAction(): Promise<ActionResult<PublicMenuData>> {
  return runAction(async () => {
    if (isLocalMode()) {
      return localGetPublicMenu();
    }

    const supabase = await createSupabaseServerClient();
    const [productsResult, categoriesResult] = await Promise.all([
      supabase
        .from("products")
        .select("id,title,category_id,base_price,is_active")
        .eq("is_active", true)
        .order("title"),
      supabase
        .from("categories")
        .select("id,name,slug,sort_order,is_active")
        .eq("is_active", true)
        .order("sort_order"),
    ]);

    if (productsResult.error) throw normalizeDatabaseError(productsResult.error);
    if (categoriesResult.error) throw normalizeDatabaseError(categoriesResult.error);

    const categories: PublicMenuCategory[] = (categoriesResult.data ?? []).map(
      (row: CategoryRow) => ({
        id: row.id,
        name: row.name,
        slug: row.slug,
        sortOrder: Number(row.sort_order),
        isActive: Boolean(row.is_active),
      }),
    );

    const categoryMap = new Map(categories.map((category) => [category.id, category]));
    const products: PublicMenuProduct[] = (productsResult.data ?? []).map((row: ProductRow) => {
      const category = categoryMap.get(row.category_id);
      return {
        id: row.id,
        title: row.title,
        categoryId: row.category_id,
        categoryName: category?.name ?? "Menu",
        categorySlug: category?.slug ?? "menu",
        basePrice: row.base_price,
        isActive: Boolean(row.is_active),
      };
    });

    const result: PublicMenuData = {
      products,
      categories,
      generatedAt: new Date().toISOString(),
      mode: "supabase",
    };
    return result;
  });
}
