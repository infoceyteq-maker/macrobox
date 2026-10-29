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
import { publicProductImage } from "@/lib/pos/product-images";
import type { ActionResult } from "@/lib/pos/types";

type ProductRow = {
  id: string;
  title: string;
  category_id: string;
  base_price: number | string;
  retail_price: number | string | null;
  day_assignment: string | null;
  quantity: string | null;
  product_category: string | null;
  image_url: string | null;
  ingredients: unknown;
  macros: unknown;
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
        .select(
          "id,title,category_id,base_price,retail_price,day_assignment,quantity,product_category,image_url,ingredients,macros,is_active",
        )
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
        basePrice: row.retail_price ?? row.base_price,
        dayAssignment: row.day_assignment ?? category?.name ?? "Everyday",
        quantity: row.quantity ?? null,
        productCategory: row.product_category ?? null,
        imageUrl: publicProductImage({
          title: row.title,
          dayAssignment: row.day_assignment ?? category?.name,
          categoryName: category?.name,
          imageUrl: row.image_url,
          ingredients: Array.isArray(row.ingredients) ? row.ingredients : [],
        }),
        ingredients: Array.isArray(row.ingredients) ? (row.ingredients as PublicMenuProduct["ingredients"]) : [],
        macros:
          row.macros && typeof row.macros === "object" && !Array.isArray(row.macros)
            ? (row.macros as PublicMenuProduct["macros"])
            : {},
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
