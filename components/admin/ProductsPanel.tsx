"use client";

import { useMemo, useState, type FormEvent } from "react";

import {
  deleteProductAction,
  setProductVisibilityAction,
  uploadProductImageAction,
  upsertProductAction,
} from "@/app/actions/pos";
import { cn, NEU } from "@/components/ui/neu";
import { notify } from "@/lib/ui/toast";
import type {
  AppRole,
  CategoryRow,
  JsonObject,
  JsonValue,
  ProductRow,
} from "@/lib/pos/types";

const DAY_ASSIGNMENTS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Everyday",
] as const;

const DAY_SORT: Record<string, number> = {
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Everyday: 6,
};

const PRODUCT_CATEGORIES = [
  "Rice",
  "Curry",
  "Sweet",
  "Sweets",
  "Healthy Meals",
  "Specials",
  "Portions",
  "Beverages",
  "Other",
] as const;

interface ProductsPanelProps {
  products: ProductRow[];
  categories: CategoryRow[];
  actorRole: AppRole;
  onChanged: () => Promise<void>;
}

interface ProductFormState {
  id: string;
  dayAssignment: (typeof DAY_ASSIGNMENTS)[number];
  name: string;
  quantity: string;
  category: string;
  protein: string;
  carbs: string;
  fat: string;
  calories: string;
  vitamins: string;
  minerals: string;
  ingredients: string;
  costPrice: string;
  retailPrice: string;
  imageUrl: string;
  isActive: boolean;
}

const emptyForm: ProductFormState = {
  id: "",
  dayAssignment: "Monday",
  name: "",
  quantity: "",
  category: "",
  protein: "",
  carbs: "",
  fat: "",
  calories: "",
  vitamins: "",
  minerals: "",
  ingredients: "[]",
  costPrice: "",
  retailPrice: "",
  imageUrl: "",
  isActive: true,
};

function asNumber(value: number | string | null | undefined): number {
  if (value === null || value === undefined || value === "") return 0;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: number | string | null | undefined): string {
  return asNumber(value).toFixed(2);
}

function macroText(macros: JsonObject | undefined, key: string): string {
  const value = macros?.[key];
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return "";
}

function firstIngredientAmount(product: ProductRow): string {
  const first = product.ingredients?.[0];
  if (first && typeof first === "object" && !Array.isArray(first)) {
    const amount = (first as Record<string, unknown>).amount;
    if (typeof amount === "string") return amount;
    if (typeof amount === "number") return String(amount);
  }
  return "";
}

function formFromProduct(product: ProductRow, categories: CategoryRow[]): ProductFormState {
  const categoryName = categories.find((category) => category.id === product.category_id)?.name;
  const day = (DAY_ASSIGNMENTS as readonly string[]).includes(product.day_assignment)
    ? (product.day_assignment as ProductFormState["dayAssignment"])
    : (DAY_ASSIGNMENTS as readonly string[]).includes(categoryName ?? "")
      ? (categoryName as ProductFormState["dayAssignment"])
      : "Everyday";

  return {
    id: product.id,
    dayAssignment: day,
    name: product.title,
    quantity: product.quantity ?? firstIngredientAmount(product),
    category: product.product_category ?? "",
    protein: macroText(product.macros, "protein"),
    carbs: macroText(product.macros, "carbs"),
    fat: macroText(product.macros, "fat"),
    calories: macroText(product.macros, "calories"),
    vitamins: macroText(product.macros, "vitamins"),
    minerals: macroText(product.macros, "minerals"),
    ingredients: JSON.stringify(product.ingredients ?? [], null, 2),
    costPrice: String(asNumber(product.cost_price)),
    retailPrice: String(asNumber(product.retail_price ?? product.base_price)),
    imageUrl: product.image_url ?? "",
    isActive: product.is_active,
  };
}

export default function ProductsPanel({
  products,
  categories,
  actorRole,
  onChanged,
}: ProductsPanelProps) {
  const [search, setSearch] = useState("");
  const [dayFilter, setDayFilter] = useState("All");
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<ProductFormState>(emptyForm);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const sortedProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return [...products]
      .sort((a, b) => {
        const dayDelta = (DAY_SORT[a.day_assignment] ?? 99) - (DAY_SORT[b.day_assignment] ?? 99);
        return dayDelta !== 0 ? dayDelta : a.title.localeCompare(b.title);
      })
      .filter((product) => {
        const day = product.day_assignment || "Everyday";
        if (dayFilter !== "All" && day !== dayFilter) return false;
        if (!query) return true;
        return [product.title, product.product_category ?? "", day, product.quantity ?? ""]
          .join(" ")
          .toLowerCase()
          .includes(query);
      });
  }, [dayFilter, products, search]);

  if (actorRole !== "ADMIN") {
    return (
      <section className={cn(NEU.card, "p-6")}>
        <h2 className="font-display text-xl font-bold">Products Management</h2>
        <p className="mt-2 text-sm text-[#6f7a74]">
          This module is restricted to Master Admin. Customers, Staff, Kitchen users, and Drivers
          cannot access product pricing, cost, image, or catalogue controls.
        </p>
      </section>
    );
  }

  function categoryFor(product: ProductRow) {
    return categories.find((category) => category.id === product.category_id);
  }

  function openAdd() {
    setForm(emptyForm);
    setImageFile(null);
    setImagePreview("");
    setFormError(null);
    setFormOpen(true);
  }

  function openEdit(product: ProductRow) {
    setForm(formFromProduct(product, categories));
    setImageFile(null);
    setImagePreview(product.image_url ?? "");
    setFormError(null);
    setFormOpen(true);
  }

  function closeForm() {
    if (saving) return;
    setFormOpen(false);
    setImageFile(null);
  }

  async function handleSaveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    let ingredients: JsonValue[];
    try {
      const parsed: unknown = JSON.parse(form.ingredients || "[]");
      if (!Array.isArray(parsed)) throw new Error("Ingredients must be a JSON array.");
      ingredients = parsed as JsonValue[];
    } catch {
      setFormError("Ingredients must be a valid JSON array.");
      return;
    }

    const costPrice = Number(form.costPrice);
    const retailPrice = Number(form.retailPrice);
    if (!Number.isFinite(costPrice) || costPrice < 0) {
      setFormError("Cost Price is mandatory and must be 0 or higher.");
      return;
    }
    if (!Number.isFinite(retailPrice) || retailPrice < 0) {
      setFormError("Wholesale/Retail Price is mandatory and must be 0 or higher.");
      return;
    }

    setSaving(true);
    try {
      let imageUrl: string | null = form.imageUrl.trim() ? form.imageUrl.trim() : null;

      // Upload first, mirroring the requested workflow. The Server Action
      // checks the Master Admin role before using Supabase Storage.
      if (imageFile) {
        const uploadData = new FormData();
        uploadData.set("file", imageFile);
        const uploadResult = await uploadProductImageAction(uploadData);
        if (!uploadResult.ok) {
          const failure = `[${uploadResult.code}] ${uploadResult.error}`;
          setFormError(failure);
          notify.error("Image upload failed", failure);
          return;
        }
        imageUrl = uploadResult.data.imageUrl;
        setForm((prev) => ({ ...prev, imageUrl: imageUrl ?? "" }));
      }

      const macros: JsonObject = {};
      if (form.protein.trim()) macros.protein = form.protein.trim();
      if (form.carbs.trim()) macros.carbs = form.carbs.trim();
      if (form.fat.trim()) macros.fat = form.fat.trim();
      if (form.calories.trim()) macros.calories = form.calories.trim();
      if (form.vitamins.trim()) macros.vitamins = form.vitamins.trim();
      if (form.minerals.trim()) macros.minerals = form.minerals.trim();

      const result = await upsertProductAction({
        ...(form.id ? { id: form.id } : {}),
        title: form.name.trim(),
        dayAssignment: form.dayAssignment,
        quantity: form.quantity.trim() ? form.quantity.trim() : null,
        productCategory: form.category.trim(),
        ingredients,
        macros,
        costPrice,
        retailPrice,
        basePrice: retailPrice,
        imageUrl,
        isActive: form.isActive,
      });

      if (!result.ok) {
        const failure = `[${result.code}] ${result.error}`;
        setFormError(failure);
        notify.error("Product not saved", failure);
        return;
      }

      notify.success(
        form.id ? "Product updated" : "Product added",
        "The customer menu will reflect this product on refresh.",
      );
      setFormOpen(false);
      setImageFile(null);
      await onChanged();
    } catch (caught) {
      const failure = caught instanceof Error ? caught.message : "Unexpected product save error.";
      setFormError(failure);
      notify.error("Product not saved", failure);
    } finally {
      setSaving(false);
    }
  }

  async function handleVisibility(product: ProductRow) {
    setBusyId(product.id);
    const result = await setProductVisibilityAction({
      productId: product.id,
      isActive: !product.is_active,
    });
    setBusyId(null);
    if (!result.ok) {
      notify.error("Visibility not changed", `[${result.code}] ${result.error}`);
      return;
    }
    notify.success(product.is_active ? "Product hidden" : "Product activated", product.title);
    await onChanged();
  }

  async function handleDelete(product: ProductRow) {
    setBusyId(product.id);
    const result = await deleteProductAction({ productId: product.id });
    setBusyId(null);
    setConfirmDeleteId(null);
    if (!result.ok) {
      notify.error("Product not deleted", `[${result.code}] ${result.error}`);
      return;
    }
    notify.success("Product deleted", product.title);
    await onChanged();
  }

  const activeCount = products.filter((product) => product.is_active).length;
  const pendingCount = products.filter((product) => asNumber(product.retail_price ?? product.base_price) <= 0).length;

  return (
    <div className="space-y-6">
      <section className={cn(NEU.card, "p-5 sm:p-6")}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#7CA982]">
              Master Admin only
            </p>
            <h2 className="mt-2 font-display text-2xl font-bold">Products Management</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#5f6d65]">
              Add, edit, hide, or delete catalogue products. Customer-facing name, day, quantity,
              nutrition, retail price, image, and availability update in the public menu after
              refresh. Cost Price is private P&amp;L data and is not exposed to customers.
            </p>
          </div>
          <button type="button" onClick={openAdd} className={NEU.buttonPrimary}>
            Add New Product
          </button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className={cn(NEU.inset, "px-4 py-3")}>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#6f7a74]">Products</p>
            <p className="mt-1 font-display text-2xl font-bold">{products.length}</p>
          </div>
          <div className={cn(NEU.inset, "px-4 py-3")}>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#6f7a74]">Visible</p>
            <p className="mt-1 font-display text-2xl font-bold">{activeCount}</p>
          </div>
          <div className={cn(NEU.inset, "px-4 py-3")}>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#6f7a74]">Price pending</p>
            <p className="mt-1 font-display text-2xl font-bold">{pendingCount}</p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-[1fr_220px]">
          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[#6f7a74]">
              Search products
            </span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className={NEU.input}
              placeholder="Search name, category, day, quantity…"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[#6f7a74]">
              Day assignment
            </span>
            <select
              value={dayFilter}
              onChange={(event) => setDayFilter(event.target.value)}
              className={NEU.input}
            >
              <option>All</option>
              {DAY_ASSIGNMENTS.map((day) => (
                <option key={day}>{day}</option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className={cn(NEU.card, "overflow-hidden p-0")}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] border-collapse text-left text-sm">
            <thead>
              <tr className="bg-[#F7F6F2] text-xs uppercase tracking-wider text-[#6f7a74]">
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Day</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Quantity</th>
                <th className="px-4 py-3">Nutrition</th>
                <th className="px-4 py-3">Cost</th>
                <th className="px-4 py-3">Retail</th>
                <th className="px-4 py-3">Margin</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedProducts.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center text-[#6f7a74]">
                    No products match the current search/filter.
                  </td>
                </tr>
              ) : (
                sortedProducts.map((product) => {
                  const category = categoryFor(product);
                  const retail = asNumber(product.retail_price ?? product.base_price);
                  const cost = asNumber(product.cost_price);
                  const margin = retail - cost;
                  return (
                    <tr key={product.id} className="border-t border-white/70 align-top">
                      <td className="px-4 py-3">
                        <div className="flex min-w-[220px] items-center gap-3">
                          {product.image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={product.image_url}
                              alt=""
                              className="h-12 w-12 shrink-0 rounded-xl object-cover"
                            />
                          ) : (
                            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#e3eddf] text-xs font-bold text-[#527a58]">
                              MB
                            </span>
                          )}
                          <span>
                            <span className="block font-display font-bold">{product.title}</span>
                            <span className="mt-0.5 block text-xs text-[#7b857f]">
                              {category?.name ?? product.day_assignment}
                            </span>
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">{product.day_assignment || category?.name || "Everyday"}</td>
                      <td className="px-4 py-3">{product.product_category || "—"}</td>
                      <td className="px-4 py-3">{product.quantity || firstIngredientAmount(product) || "—"}</td>
                      <td className="px-4 py-3 text-xs leading-5 text-[#5f6d65]">
                        P {macroText(product.macros, "protein") || "—"} · C {macroText(product.macros, "carbs") || "—"}
                        <br />F {macroText(product.macros, "fat") || "—"} · {macroText(product.macros, "calories") || "—"}
                      </td>
                      <td className="px-4 py-3">LKR {money(cost)}</td>
                      <td className="px-4 py-3">{retail <= 0 ? "Price pending" : `LKR ${money(retail)}`}</td>
                      <td className="px-4 py-3">{retail <= 0 ? "—" : `LKR ${money(margin)}`}</td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2.5 py-1 text-xs font-bold",
                            product.is_active ? "bg-[#dcead7] text-[#3f6b45]" : "bg-[#e5e3de] text-[#5b5e5a]",
                          )}
                        >
                          {product.is_active ? "Visible" : "Hidden"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex min-w-[210px] flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => openEdit(product)}
                            className={cn(NEU.button, "!px-3 !py-2 text-xs")}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            disabled={busyId === product.id}
                            onClick={() => void handleVisibility(product)}
                            className={cn(NEU.button, "!px-3 !py-2 text-xs")}
                          >
                            {product.is_active ? "Hide" : "Activate"}
                          </button>
                          {confirmDeleteId === product.id ? (
                            <>
                              <button
                                type="button"
                                disabled={busyId === product.id}
                                onClick={() => void handleDelete(product)}
                                className="rounded-2xl bg-[#b84a3a] px-3 py-2 text-xs font-bold text-white shadow"
                              >
                                Confirm Delete
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className={cn(NEU.button, "!px-3 !py-2 text-xs")}
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(product.id)}
                              className="rounded-2xl bg-[#f7e2de] px-3 py-2 text-xs font-bold text-[#8a3b2f] shadow"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {formOpen ? (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-[#2E3033]/35 p-0 backdrop-blur-sm sm:items-center sm:p-6">
          <button
            type="button"
            aria-label="Close product form"
            onClick={closeForm}
            className="absolute inset-0 h-full w-full cursor-default"
          />
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="product-form-title"
            className={cn(
              NEU.card,
              "relative max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-b-none p-5 sm:rounded-[1.75rem] sm:p-7",
            )}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#7CA982]">
                  Master Admin
                </p>
                <h3 id="product-form-title" className="mt-2 font-display text-2xl font-bold">
                  {form.id ? "Edit Product" : "Add New Product"}
                </h3>
              </div>
              <button type="button" onClick={closeForm} className={cn(NEU.button, "h-10 w-10 !px-0 !py-0")}>
                ×
              </button>
            </div>

            {formError ? (
              <div className="mt-4 rounded-2xl bg-[#f7e2de] px-4 py-3 text-sm font-medium text-[#8a3b2f]" role="alert">
                {formError}
              </div>
            ) : null}

            <form onSubmit={handleSaveProduct} className="mt-6 space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-bold">Date/Day Assignment *</span>
                  <select
                    value={form.dayAssignment}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        dayAssignment: event.target.value as ProductFormState["dayAssignment"],
                      }))
                    }
                    className={NEU.input}
                    required
                  >
                    {DAY_ASSIGNMENTS.map((day) => (
                      <option key={day}>{day}</option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-bold">Product Name *</span>
                  <input
                    value={form.name}
                    onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                    className={NEU.input}
                    placeholder="e.g. Dhal Curry"
                    required
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-bold">Quantity/Weight *</span>
                  <input
                    value={form.quantity}
                    onChange={(event) => setForm((prev) => ({ ...prev, quantity: event.target.value }))}
                    className={NEU.input}
                    placeholder="e.g. 100g"
                    required
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-bold">Category *</span>
                  <input
                    value={form.category}
                    onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}
                    className={NEU.input}
                    placeholder="e.g. Rice, Curry, Sweet"
                    list="product-category-options"
                    required
                  />
                  <datalist id="product-category-options">
                    {PRODUCT_CATEGORIES.map((category) => (
                      <option key={category} value={category} />
                    ))}
                  </datalist>
                </label>
              </div>

              <fieldset>
                <legend className="font-display text-base font-bold">Nutrition Data</legend>
                <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {([
                    ["protein", "Protein"],
                    ["carbs", "Carbs"],
                    ["fat", "Fat"],
                    ["calories", "Total Calories"],
                    ["vitamins", "Vitamins"],
                    ["minerals", "Minerals"],
                  ] as const).map(([key, label]) => (
                    <label key={key} className="block">
                      <span className="mb-2 block text-sm font-bold">{label}</span>
                      <input
                        value={form[key]}
                        onChange={(event) => setForm((prev) => ({ ...prev, [key]: event.target.value }))}
                        className={NEU.input}
                        placeholder={key === "calories" ? "e.g. 469 kcal" : key === "vitamins" || key === "minerals" ? "Approved text" : "e.g. 54.5g"}
                      />
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-bold">Cost Price (LKR) *</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.costPrice}
                    onChange={(event) => setForm((prev) => ({ ...prev, costPrice: event.target.value }))}
                    className={NEU.input}
                    placeholder="Backend P&L cost"
                    required
                  />
                  <span className="mt-2 block text-xs text-[#6f7a74]">Private Admin/P&amp;L value. Never shown to customers.</span>
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-bold">Wholesale/Retail Price (LKR) *</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.retailPrice}
                    onChange={(event) => setForm((prev) => ({ ...prev, retailPrice: event.target.value }))}
                    className={NEU.input}
                    placeholder="e.g. 1200 or specific item price"
                    required
                  />
                  <span className="mt-2 block text-xs text-[#6f7a74]">Shown on the Customer UI. Use 0 only while pricing is pending.</span>
                </label>
              </div>

              <div className="grid gap-4 lg:grid-cols-[180px_1fr]">
                <div>
                  {imagePreview || form.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={imagePreview || form.imageUrl}
                      alt="Product preview"
                      className="h-36 w-full rounded-2xl object-cover"
                    />
                  ) : (
                    <div className={cn(NEU.inset, "flex h-36 items-center justify-center text-sm font-bold text-[#527a58]")}>
                      No image
                    </div>
                  )}
                </div>
                <div className="space-y-4">
                  <label className="block">
                    <span className="mb-2 block text-sm font-bold">Image Gallery Upload</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      onChange={(event) => {
                        const file = event.target.files?.[0] ?? null;
                        setImageFile(file);
                        setImagePreview(file ? URL.createObjectURL(file) : form.imageUrl);
                      }}
                      className={cn(NEU.input, "text-sm")}
                    />
                    <span className="mt-2 block text-xs text-[#6f7a74]">
                      Uploads to Supabase Storage bucket <strong>public_assets</strong> under
                      <strong> product_images/</strong> when saved.
                    </span>
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-bold">Primary Image URL</span>
                    <input
                      value={form.imageUrl}
                      onChange={(event) => {
                        setForm((prev) => ({ ...prev, imageUrl: event.target.value }));
                        setImagePreview(event.target.value);
                      }}
                      className={NEU.input}
                      placeholder="https://…"
                    />
                  </label>
                </div>
              </div>

              <label className="block">
                <span className="mb-2 block text-sm font-bold">Ingredients JSON array</span>
                <textarea
                  value={form.ingredients}
                  onChange={(event) => setForm((prev) => ({ ...prev, ingredients: event.target.value }))}
                  className={cn(NEU.input, "min-h-24 font-mono text-xs")}
                  placeholder='[{"name":"Dhal curry","amount":"75g"}]'
                />
                <span className="mt-2 block text-xs text-[#6f7a74]">
                  Used by combo products and order snapshots. Leave as [] for a single item and the
                  product name/quantity will be used.
                </span>
              </label>

              <label className={cn(NEU.inset, "flex items-center gap-3 px-4 py-3 text-sm font-semibold")}>
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(event) => setForm((prev) => ({ ...prev, isActive: event.target.checked }))}
                />
                Visible to customers
              </label>

              <div className="flex flex-wrap justify-end gap-2">
                <button type="button" onClick={closeForm} className={NEU.button} disabled={saving}>
                  Cancel
                </button>
                <button type="submit" className={NEU.buttonPrimary} disabled={saving}>
                  {saving ? "Saving…" : form.id ? "Save Changes" : "Add Product"}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </div>
  );
}
