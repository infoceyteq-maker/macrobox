import { PGlite } from "@electric-sql/pglite";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { CATALOG_SEED_MEALS } from "./catalog-seed";
import type {
  CustomerAuthSuccess,
  CustomerProfileInput,
  LeadProfileDetails,
} from "./customer-auth";
import { LOCAL_CUSTOMER_OTP } from "./customer-auth";
import { normalizeDatabaseError, PosActionError } from "./errors";
import type { DashboardData, DashboardOrder, DirectoryUser } from "./dashboard-types";
import type {
  AppRole,
  AppUserRow,
  CategoryRow,
  DeliverySettingsRow,
  ExpenseRow,
  JsonObject,
  JsonValue,
  OrderRow,
  OrderStatus,
  OrderStatusTransitionRow,
  ProductRow,
} from "./types";
import type {
  AssignDriverInput,
  CreateCategoryInput,
  CreateOrderInput,
  CreateExpenseInput,
  DeleteProductInput,
  SetProductVisibilityInput,
  SetTransportRateInput,
  UpdateEmployeeInput,
  UpsertProductInput,
} from "./schemas";
import type {
  PublicMenuCategory,
  PublicMenuData,
  PublicMenuProduct,
} from "./public-menu";

const MIGRATION_PATH = path.join(
  process.cwd(),
  "supabase/migrations/202610270001_pos_core.sql",
);
const CLEAR_RATE_MIGRATION_PATH = path.join(
  process.cwd(),
  "supabase/migrations/202610270004_pos_clear_transport_rate.sql",
);
const PUBLIC_MENU_MIGRATION_PATH = path.join(
  process.cwd(),
  "supabase/migrations/202610270005_public_menu_read.sql",
);
const CUSTOMER_AUTH_MIGRATION_PATH = path.join(
  process.cwd(),
  "supabase/migrations/202610270006_customer_auth.sql",
);
const CUSTOMER_PHONE_MIGRATION_PATH = path.join(
  process.cwd(),
  "supabase/migrations/202610270007_customer_phone_normalization.sql",
);
const TIERED_TRANSPORT_MIGRATION_PATH = path.join(
  process.cwd(),
  "supabase/migrations/202610270009_tiered_transport_rate.sql",
);
const CUSTOMER_PROFILE_OTP_MIGRATION_PATH = path.join(
  process.cwd(),
  "supabase/migrations/202610270010_customer_profile_otp.sql",
);
const LEAD_REGISTRATION_MIGRATION_PATH = path.join(
  process.cwd(),
  "supabase/migrations/202610270011_lead_registration.sql",
);
const PRODUCTS_MANAGEMENT_MIGRATION_PATH = path.join(
  process.cwd(),
  "supabase/migrations/202610270013_products_management.sql",
);
const EXPENSES_MIGRATION_PATH = path.join(
  process.cwd(),
  "supabase/migrations/202610270014_expenses.sql",
);

const ROLE_LABELS: Record<AppRole, string> = {
  ADMIN: "Admin",
  MANAGER: "Manager",
  FRONT_DESK: "Front Desk",
  KITCHEN: "Kitchen",
  DRIVER: "Driver",
  CUSTOMER: "Customer",
};

export const LOCAL_DEMO_USERS: {
  id: string;
  email: string;
  name: string;
  role: AppRole;
}[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    email: "admin@macrobox.local",
    name: "MacroBox Admin",
    role: "ADMIN",
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    email: "manager@macrobox.local",
    name: "MacroBox Manager",
    role: "MANAGER",
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    email: "frontdesk@macrobox.local",
    name: "MacroBox Front Desk",
    role: "FRONT_DESK",
  },
  {
    id: "44444444-4444-4444-8444-444444444444",
    email: "kitchen@macrobox.local",
    name: "MacroBox Kitchen",
    role: "KITCHEN",
  },
  {
    id: "55555555-5555-4555-8555-555555555555",
    email: "driver@macrobox.local",
    name: "MacroBox Driver",
    role: "DRIVER",
  },
  {
    id: "66666666-6666-4666-8666-666666666666",
    email: "customer@macrobox.local",
    name: "MacroBox Customer",
    role: "CUSTOMER",
  },
];

type AnyRow = Record<string, any>;
type QueryResult<T = AnyRow> = { rows: T[] };
type LocalTx = {
  query: <T = AnyRow>(sql: string, params?: unknown[]) => Promise<QueryResult<T>>;
};

interface DbGlobal {
  __macroboxPosLocalDb?: Promise<PGlite>;
}

const globalForDb = globalThis as unknown as DbGlobal;

function serialize<T>(value: unknown): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function toOrder(row: AnyRow): OrderRow {
  const order = serialize<OrderRow>(row);
  return { ...order, version: Number(order.version) };
}

function toDirectoryUser(user: AppUserRow): DirectoryUser {
  return { id: user.id, name: user.name, email: user.email };
}

async function initDb(): Promise<PGlite> {
  const db = new PGlite();
  await db.waitReady;

  await db.exec(`
    do $$ begin
      create role anon;
    exception when duplicate_object then null;
    end $$;
    do $$ begin
      create role authenticated;
    exception when duplicate_object then null;
    end $$;
    do $$ begin
      create role service_role;
    exception when duplicate_object then null;
    end $$;

    create schema if not exists auth;
    create table if not exists auth.users (
      id uuid primary key,
      email text,
      raw_user_meta_data jsonb not null default '{}'::jsonb
    );
    create or replace function auth.uid()
    returns uuid
    language sql
    stable
    as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
    $$;
  `);

  const migration = (await fs.readFile(MIGRATION_PATH, "utf8")).replace(
    /create extension if not exists pgcrypto;\s*/g,
    "",
  );
  await db.exec(migration);

  const clearRateMigration = await fs.readFile(CLEAR_RATE_MIGRATION_PATH, "utf8");
  await db.exec(clearRateMigration);

  const publicMenuMigration = await fs.readFile(PUBLIC_MENU_MIGRATION_PATH, "utf8");
  await db.exec(publicMenuMigration);

  const customerAuthMigration = await fs.readFile(CUSTOMER_AUTH_MIGRATION_PATH, "utf8");
  await db.exec(customerAuthMigration);

  const customerPhoneMigration = await fs.readFile(CUSTOMER_PHONE_MIGRATION_PATH, "utf8");
  await db.exec(customerPhoneMigration);

  const tieredTransportMigration = await fs.readFile(TIERED_TRANSPORT_MIGRATION_PATH, "utf8");
  await db.exec(tieredTransportMigration);

  const customerProfileOtpMigration = await fs.readFile(CUSTOMER_PROFILE_OTP_MIGRATION_PATH, "utf8");
  await db.exec(customerProfileOtpMigration);

  const leadRegistrationMigration = await fs.readFile(LEAD_REGISTRATION_MIGRATION_PATH, "utf8");
  await db.exec(leadRegistrationMigration);

  const productsManagementMigration = await fs.readFile(PRODUCTS_MANAGEMENT_MIGRATION_PATH, "utf8");
  await db.exec(productsManagementMigration);

  const expensesMigration = await fs.readFile(EXPENSES_MIGRATION_PATH, "utf8");
  await db.exec(expensesMigration);

  await db.exec(`
    create table if not exists public.local_auth_users (
      id uuid primary key references auth.users(id) on delete cascade,
      email text not null unique,
      password text not null,
      role public.app_role not null,
      name text not null
    );

    create table if not exists public.local_email_otps (
      email text primary key,
      otp text not null,
      expires_at timestamptz not null default now()
    );

    create table if not exists public.local_phone_otps (
      phone text primary key,
      otp text not null,
      expires_at timestamptz not null default now(),
      lead_name text,
      lead_email text,
      lead_location text
    );
  `);

  await seedUsers(db);
  await seedCatalog(db);

  return db;
}

export function getLocalDb(): Promise<PGlite> {
  if (!globalForDb.__macroboxPosLocalDb) {
    globalForDb.__macroboxPosLocalDb = initDb();
  }
  return globalForDb.__macroboxPosLocalDb;
}

async function seedUsers(db: PGlite): Promise<void> {
  const password = process.env.POS_DEMO_PASSWORD || "MacroBox@2026!";

  for (const user of LOCAL_DEMO_USERS) {
    await db.query(
      `insert into auth.users (id, email, raw_user_meta_data)
       values ($1, $2, $3::jsonb)
       on conflict (id) do update set
         email = excluded.email,
         raw_user_meta_data = excluded.raw_user_meta_data`,
      [user.id, user.email, JSON.stringify({ name: user.name })],
    );

    await db.query(
      `update public.app_users
       set role = $2::public.app_role, name = $3, email = $4,
           status = 'ACTIVE'::public.employee_status
       where id = $1`,
      [user.id, user.role, user.name, user.email],
    );

    await db.query(
      `insert into public.local_auth_users (id, email, password, role, name)
       values ($1, $2, $3, $4::public.app_role, $5)
       on conflict (id) do update set
         email = excluded.email,
         password = excluded.password,
         role = excluded.role,
         name = excluded.name`,
      [user.id, user.email, password, user.role, user.name],
    );
  }
}

async function seedCatalog(db: PGlite): Promise<void> {
  for (let index = 0; index < CATALOG_SEED_MEALS.length; index += 1) {
    const meal = CATALOG_SEED_MEALS[index];
    const categoryResult = await db.query<AnyRow>(
      `insert into public.categories (name, slug, description, sort_order, is_active)
       values ($1, $2, null, $3, true)
       on conflict (slug) do update set
         name = excluded.name,
         sort_order = excluded.sort_order
       returning id`,
      [meal.day, meal.slug, index + 1],
    );
    const categoryId = categoryResult.rows[0]?.id as string;

    await db.query(
      `insert into public.products
         (title, category_id, day_assignment, product_category, ingredients, macros, base_price, cost_price, retail_price, is_active)
       select $1, $2, $5, 'Healthy Meals', $3::jsonb, $4::jsonb, 0.00, 0.00, 0.00, true
       where not exists (
         select 1 from public.products
         where category_id = $2 and title = $1
       )`,
      [
        meal.title,
        categoryId,
        JSON.stringify(meal.ingredients),
        JSON.stringify(meal.macros),
        meal.day,
      ],
    );

    // Each supplied combo ingredient is also a separately purchasable daily
    // item in the same weekday category. Its price remains the existing
    // 0.00 "price pending" placeholder until Admin confirms real pricing.
    for (const ingredient of meal.ingredients) {
      await db.query(
        `insert into public.products
           (title, category_id, day_assignment, quantity, ingredients, macros, base_price, cost_price, retail_price, is_active)
         select $1, $2, $4, $5, $3::jsonb, '{}'::jsonb, 0.00, 0.00, 0.00, true
         where not exists (
           select 1 from public.products
           where category_id = $2 and title = $1
         )`,
        [ingredient.name, categoryId, JSON.stringify([ingredient]), meal.day, ingredient.amount],
      );
    }
  }
}

async function asUser<T>(userId: string, fn: (tx: LocalTx) => Promise<T>): Promise<T> {
  const db = await getLocalDb();
  try {
    return await db.transaction(async (tx) => {
      const localTx = tx as unknown as LocalTx;
      await localTx.query(
        "select set_config('request.jwt.claim.sub', $1, true)",
        [userId],
      );
      return fn(localTx);
    });
  } catch (error) {
    const dbError =
      error && typeof error === "object"
        ? (error as { message?: string; code?: string; details?: string; hint?: string })
        : { message: "Local database request failed." };
    throw normalizeDatabaseError(dbError);
  }
}

async function queryOne<T>(tx: LocalTx, sql: string, params: unknown[] = []): Promise<T> {
  const result = await tx.query<T>(sql, params);
  if (!result.rows[0]) {
    throw new PosActionError("EMPTY_RESULT", "The database returned no row.");
  }
  return result.rows[0];
}

async function assertRole(userId: string, roles: AppRole[]): Promise<AppUserRow> {
  const actor = await localGetActor(userId);
  if (!roles.includes(actor.role)) {
    throw new PosActionError(
      "FORBIDDEN",
      `Your role (${actor.role}) cannot perform this action.`,
    );
  }
  return actor;
}

export async function localSignIn(email: string, password: string): Promise<string> {
  const db = await getLocalDb();
  const result = await db.query<AnyRow>(
    `select id from public.local_auth_users
     where lower(email) = lower($1) and password = $2`,
    [email.trim(), password],
  );
  const id = result.rows[0]?.id;
  if (!id) {
    throw new PosActionError("SIGN_IN_FAILED", "Invalid email or password.");
  }
  return String(id);
}

/** Local preview equivalent of Supabase phone OTP send. */
export async function localSendPhoneOtp(
  phone: string,
  lead?: LeadProfileDetails,
): Promise<{ phone: string; otpSent: boolean; devOtp: string }> {
  const db = await getLocalDb();
  await db.query(
    `insert into public.local_phone_otps
       (phone, otp, expires_at, lead_name, lead_email, lead_location)
     values ($1, $2, now() + interval '5 minutes', $3, $4, $5)
     on conflict (phone) do update
       set otp = excluded.otp,
           expires_at = excluded.expires_at,
           lead_name = excluded.lead_name,
           lead_email = excluded.lead_email,
           lead_location = excluded.lead_location`,
    [
      phone,
      LOCAL_CUSTOMER_OTP,
      lead?.name?.trim() || null,
      lead?.email?.trim().toLowerCase() || null,
      lead?.location?.trim() || null,
    ],
  );
  return { phone, otpSent: true, devOtp: LOCAL_CUSTOMER_OTP };
}

/** Local preview OTP verification; creates the customer profile on first use. */
export async function localVerifyPhoneOtp(
  phone: string,
  token: string,
  lead?: LeadProfileDetails,
): Promise<CustomerAuthSuccess> {
  const db = await getLocalDb();
  const otpResult = await db.query<AnyRow>(
    `select otp, lead_name, lead_email, lead_location from public.local_phone_otps
      where phone = $1 and expires_at > now()`,
    [phone],
  );
  if (!otpResult.rows[0] || otpResult.rows[0].otp !== token) {
    throw new PosActionError(
      "INVALID_OTP",
      "That verification code is invalid or has expired.",
    );
  }

  const leadName =
    lead?.name?.trim() || (otpResult.rows[0].lead_name as string | null) || "";
  const leadLocation =
    lead?.location?.trim() ||
    (otpResult.rows[0].lead_location as string | null) ||
    "";

  let userResult = await db.query<AnyRow>(
    `select id, email from public.app_users
      where role = 'CUSTOMER'
        and regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g')
          = regexp_replace($1, '[^0-9]', '', 'g')
      limit 1`,
    [phone],
  );

  let userId: string;
  let email: string;

  if (userResult.rows[0]) {
    userId = String(userResult.rows[0].id);
    email = userResult.rows[0].email ? String(userResult.rows[0].email) : "";
    // Returning customer: only fill an empty delivery address with the
    // registration city; never overwrite details saved in My Profile.
    if (leadLocation) {
      await db.query(
        `update public.app_users
            set delivery_address = coalesce(delivery_address, $2), updated_at = now()
          where id = $1`,
        [userId, leadLocation],
      );
    }
  } else {
    userId = randomUUID();
    const initialName = leadName || `Customer ${phone.slice(-4)}`;
    await db.query(
      `insert into auth.users (id, email, raw_user_meta_data)
       values ($1, null, $2::jsonb)`,
      [
        userId,
        JSON.stringify({
          phone,
          name: initialName,
          full_name: initialName,
          location: leadLocation || null,
          signup_source: leadName ? "customer_lead_registration" : "customer_phone_otp",
        }),
      ],
    );
    await db.query(
      `update public.app_users
          set role = 'CUSTOMER', status = 'ACTIVE', name = $2, email = null, phone = $3,
              delivery_address = coalesce(delivery_address, $4)
        where id = $1`,
      [userId, initialName, phone, leadLocation || null],
    );
    email = "";
  }

  await db.query(`delete from public.local_phone_otps where phone = $1`, [phone]);
  return { userId, email, phone };
}

/** Local preview equivalent of Supabase email OTP send. */
export async function localSendEmailOtp(
  email: string,
): Promise<{ email: string; otpSent: boolean; devOtp: string }> {
  const db = await getLocalDb();
  const normalized = email.trim().toLowerCase();
  await db.query(
    `insert into public.local_email_otps (email, otp, expires_at)
     values ($1, $2, now() + interval '5 minutes')
     on conflict (email) do update
       set otp = excluded.otp,
           expires_at = excluded.expires_at`,
    [normalized, LOCAL_CUSTOMER_OTP],
  );
  return { email: normalized, otpSent: true, devOtp: LOCAL_CUSTOMER_OTP };
}

/** Local preview email OTP verification; creates the customer profile on first use. */
export async function localVerifyEmailOtp(
  email: string,
  token: string,
): Promise<CustomerAuthSuccess> {
  const db = await getLocalDb();
  const normalized = email.trim().toLowerCase();
  const otpResult = await db.query<AnyRow>(
    `select otp from public.local_email_otps
      where email = $1 and expires_at > now()`,
    [normalized],
  );
  if (!otpResult.rows[0] || otpResult.rows[0].otp !== token) {
    throw new PosActionError(
      "INVALID_OTP",
      "That verification code is invalid or has expired.",
    );
  }

  const userResult = await db.query<AnyRow>(
    `select id, role, phone from public.app_users
      where lower(coalesce(email, '')) = $1
      limit 1`,
    [normalized],
  );

  let userId: string;
  let phone: string | null;

  if (userResult.rows[0]) {
    if (String(userResult.rows[0].role) !== "CUSTOMER") {
      throw new PosActionError(
        "STAFF_EMAIL",
        "This email belongs to a staff account. Please use the employee sign-in instead.",
      );
    }
    userId = String(userResult.rows[0].id);
    phone = userResult.rows[0].phone ? String(userResult.rows[0].phone) : null;
  } else {
    userId = randomUUID();
    const initialName = normalized.split("@")[0] || "MacroBox Customer";
    await db.query(
      `insert into auth.users (id, email, raw_user_meta_data)
       values ($1, $2, $3::jsonb)`,
      [
        userId,
        normalized,
        JSON.stringify({ name: initialName, signup_source: "customer_email_otp" }),
      ],
    );
    await db.query(
      `update public.app_users
          set role = 'CUSTOMER', status = 'ACTIVE', name = $2, email = $3, phone = null
        where id = $1`,
      [userId, initialName, normalized],
    );
    phone = null;
  }

  await db.query(`delete from public.local_email_otps where email = $1`, [normalized]);
  return { userId, email: normalized, phone };
}

/** Local preview email-link equivalent: attach the email immediately. */
export async function localLinkCustomerEmail(
  userId: string,
  email: string,
): Promise<{ userId: string; email: string }> {
  const db = await getLocalDb();
  await db.query(
    `update auth.users
        set email = $2,
            raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
              || jsonb_build_object('email', $2::text)
      where id = $1`,
    [userId, email],
  );
  await db.query(
    `update public.app_users set email = $2, updated_at = now() where id = $1`,
    [userId, email],
  );
  return { userId, email };
}

/** Local preview profile update. */
export async function localUpdateCustomerProfile(
  userId: string,
  input: CustomerProfileInput,
): Promise<AppUserRow> {
  const db = await getLocalDb();
  await db.query(
    `update public.app_users
        set name = coalesce(nullif($2, ''), name),
            delivery_address = nullif($3, ''),
            delivery_notes = nullif($4, ''),
            profile_completed_at = now(),
            updated_at = now()
      where id = $1`,
    [userId, input.name, input.deliveryAddress, input.deliveryNotes],
  );
  return localGetActor(userId);
}

export async function localGetActor(userId: string): Promise<AppUserRow> {
  const db = await getLocalDb();
  const result = await db.query(
    "select * from public.app_users where id = $1",
    [userId],
  );
  const row = result.rows[0];
  if (!row) {
    throw new PosActionError(
      "USER_NOT_PROVISIONED",
      "Your account is not provisioned for the POS system.",
    );
  }
  return serialize<AppUserRow>(row);
}

export async function localCreateOrder(
  userId: string,
  input: CreateOrderInput,
): Promise<OrderRow> {
  return asUser(userId, async (tx) => {
    const row = await queryOne<AnyRow>(
      tx,
      `select * from public.create_order_with_items($1, $2::jsonb, $3, $4)`,
      [
        input.customerId,
        JSON.stringify(input.items),
        input.deliveryAddress ?? null,
        input.deliveryNotes ?? null,
      ],
    );
    return toOrder(row);
  });
}

export async function localTransition(
  userId: string,
  toStatus: OrderStatus,
  input: {
    orderId: string;
    expectedStatus?: OrderStatus;
    expectedVersion?: number;
    metadata?: Record<string, unknown>;
  },
): Promise<OrderRow> {
  return asUser(userId, async (tx) => {
    const row = await queryOne<AnyRow>(
      tx,
      `select * from public.transition_order_status($1, $2, $3, $4, $5::jsonb)`,
      [
        input.orderId,
        toStatus,
        input.expectedStatus ?? null,
        input.expectedVersion ?? null,
        JSON.stringify(input.metadata ?? {}),
      ],
    );
    return toOrder(row);
  });
}

export async function localAssignDriver(
  userId: string,
  input: AssignDriverInput,
): Promise<OrderRow> {
  return asUser(userId, async (tx) => {
    const row = await queryOne<AnyRow>(
      tx,
      `select * from public.assign_driver_to_order($1, $2, $3, $4)`,
      [input.orderId, input.driverId, input.dispatch, input.expectedStatus],
    );
    return toOrder(row);
  });
}

export async function localSetTransportRate(
  userId: string,
  input: SetTransportRateInput,
): Promise<DeliverySettingsRow> {
  return asUser(userId, async (tx) => {
    const row = await queryOne<AnyRow>(
      tx,
      `select * from public.set_transport_rate($1, $2)`,
      [input.perKmRate, input.freeDistanceKm ?? null],
    );
    return serialize<DeliverySettingsRow>(row);
  });
}

export async function localActivateTieredTransportRate(
  userId: string,
): Promise<DeliverySettingsRow> {
  return asUser(userId, async (tx) => {
    const row = await queryOne<AnyRow>(
      tx,
      `select * from public.activate_tiered_transport_rate()`,
      [],
    );
    return serialize<DeliverySettingsRow>(row);
  });
}

export async function localClearTransportRate(
  userId: string,
): Promise<DeliverySettingsRow> {
  return asUser(userId, async (tx) => {
    const row = await queryOne<AnyRow>(
      tx,
      `select * from public.clear_transport_rate()`,
      [],
    );
    return serialize<DeliverySettingsRow>(row);
  });
}

export async function localGetPublicMenu(): Promise<PublicMenuData> {
  const db = await getLocalDb();
  const [categoriesResult, productsResult] = await Promise.all([
    db.query<AnyRow>(
      `select id, name, slug, sort_order, is_active
       from public.categories
       where is_active
       order by sort_order, name`,
    ),
    db.query<AnyRow>(
      `select p.id, p.title, p.category_id, p.base_price, p.retail_price,
              p.day_assignment, p.quantity, p.product_category, p.image_url,
              p.ingredients, p.macros, p.is_active,
              c.name as category_name, c.slug as category_slug
       from public.products p
       join public.categories c on c.id = p.category_id
       where p.is_active and c.is_active
       order by c.sort_order, p.title`,
    ),
  ]);

  const categories = serialize<PublicMenuCategory[]>(
    categoriesResult.rows.map((row: AnyRow) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      sortOrder: Number(row.sort_order),
      isActive: Boolean(row.is_active),
    })),
  );
  const products = serialize<PublicMenuProduct[]>(
    productsResult.rows.map((row: AnyRow) => ({
      id: row.id,
      title: row.title,
      categoryId: row.category_id,
      categoryName: row.category_name,
      categorySlug: row.category_slug,
      basePrice: row.retail_price ?? row.base_price,
      dayAssignment: row.day_assignment ?? row.category_name,
      quantity: row.quantity ?? null,
      productCategory: row.product_category ?? null,
      imageUrl: row.image_url ?? null,
      ingredients: Array.isArray(row.ingredients) ? row.ingredients : [],
      macros:
        row.macros && typeof row.macros === "object" && !Array.isArray(row.macros)
          ? row.macros
          : {},
      isActive: Boolean(row.is_active),
    })),
  );

  return {
    products,
    categories,
    generatedAt: new Date().toISOString(),
    mode: "local",
  };
}

export async function localUpdateEmployee(
  actorId: string,
  input: UpdateEmployeeInput,
): Promise<AppUserRow> {
  await assertRole(actorId, ["ADMIN"]);
  return asUser(actorId, async (tx) => {
    const row = await queryOne<AnyRow>(
      tx,
      `update public.app_users
          set role = $2::public.app_role,
              status = $3::public.employee_status,
              name = $4,
              phone = $5,
              salary_structure = $6::jsonb
        where id = $1
        returning *`,
      [
        input.userId,
        input.role,
        input.status,
        input.name,
        input.phone ?? null,
        JSON.stringify(input.salaryStructure ?? {}),
      ],
    );
    await tx.query(
      `update public.local_auth_users
          set role = $2::public.app_role, name = $3
        where id = $1`,
      [input.userId, input.role, input.name],
    );
    return serialize<AppUserRow>(row);
  });
}

export async function localSetProductVisibility(
  userId: string,
  input: SetProductVisibilityInput,
): Promise<ProductRow> {
  return asUser(userId, async (tx) => {
    const row = await queryOne<AnyRow>(
      tx,
      `select * from public.set_product_active($1, $2)`,
      [input.productId, input.isActive],
    );
    return serialize<ProductRow>(row);
  });
}

export async function localCreateCategory(
  userId: string,
  input: CreateCategoryInput,
): Promise<CategoryRow> {
  await assertRole(userId, ["ADMIN"]);
  const db = await getLocalDb();
  try {
    const result = await db.query(
      `insert into public.categories
         (name, slug, description, sort_order, is_active)
       values ($1, $2, $3, $4, $5)
       returning *`,
      [
        input.name,
        input.slug,
        input.description ?? null,
        input.sortOrder,
        input.isActive,
      ],
    );
    return serialize<CategoryRow>(result.rows[0]);
  } catch (error) {
    throw normalizeDatabaseError(error as { message?: string });
  }
}

const PRODUCT_DAY_SORT: Record<string, number> = {
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Everyday: 6,
};

async function resolveLocalProductCategoryId(
  db: PGlite,
  input: UpsertProductInput,
): Promise<string> {
  if (input.dayAssignment) {
    const slug = input.dayAssignment.toLowerCase();
    const existing = await db.query<AnyRow>(
      "select id from public.categories where slug = $1",
      [slug],
    );
    if (existing.rows[0]?.id) return existing.rows[0].id as string;

    const inserted = await db.query<AnyRow>(
      `insert into public.categories (name, slug, description, sort_order, is_active)
       values ($1, $2, $3, $4, true)
       returning id`,
      [
        input.dayAssignment,
        slug,
        input.dayAssignment === "Everyday" ? "Available every day" : null,
        PRODUCT_DAY_SORT[input.dayAssignment] ?? 99,
      ],
    );
    return inserted.rows[0].id as string;
  }

  if (input.categoryId) return input.categoryId;
  throw new PosActionError("VALIDATION_ERROR", "A product category/day assignment is required.");
}

export async function localUpsertProduct(
  userId: string,
  input: UpsertProductInput,
): Promise<ProductRow> {
  await assertRole(userId, ["ADMIN"]);
  const db = await getLocalDb();
  try {
    const existingResult = input.id
      ? await db.query<AnyRow>("select * from public.products where id = $1", [input.id])
      : null;
    const existing = existingResult?.rows[0] as AnyRow | undefined;
    if (input.id && !existing) {
      throw new PosActionError("PRODUCT_NOT_FOUND", "Product not found.");
    }

    const categoryId = await resolveLocalProductCategoryId(db, input);
    const categoryResult = await db.query<AnyRow>(
      "select name from public.categories where id = $1",
      [categoryId],
    );
    const categoryName = (categoryResult.rows[0]?.name as string | undefined) ?? "Everyday";
    const dayAssignment =
      input.dayAssignment ??
      (existing?.day_assignment as string | undefined) ??
      (PRODUCT_DAY_SORT[categoryName] ? categoryName : "Everyday");
    const retailPrice =
      input.retailPrice ?? input.basePrice ?? existing?.retail_price ?? existing?.base_price ?? 0;
    const costPrice = input.costPrice ?? existing?.cost_price ?? 0;
    const quantity =
      input.quantity !== undefined ? input.quantity : (existing?.quantity ?? null);
    const productCategory =
      input.productCategory !== undefined
        ? input.productCategory
        : (existing?.product_category ?? null);
    const imageUrl = input.imageUrl !== undefined ? input.imageUrl : (existing?.image_url ?? null);
    const suppliedIngredients = input.ingredients as JsonValue[];
    const ingredients =
      suppliedIngredients.length > 0
        ? suppliedIngredients
        : existing?.ingredients && !input.id
          ? (existing.ingredients as JsonValue[])
          : existing?.ingredients && suppliedIngredients.length === 0 && input.id
            ? (existing.ingredients as JsonValue[])
            : [{ name: input.title, amount: quantity ?? "" }];

    const result = input.id
      ? await db.query(
          `update public.products set
             title = $2,
             category_id = $3,
             day_assignment = $4,
             quantity = $5,
             product_category = $6,
             ingredients = $7::jsonb,
             macros = $8::jsonb,
             base_price = $9,
             cost_price = $10,
             retail_price = $11,
             image_url = $12,
             is_active = $13,
             updated_at = now()
           where id = $1
           returning *`,
          [
            input.id,
            input.title,
            categoryId,
            dayAssignment,
            quantity,
            productCategory,
            JSON.stringify(ingredients),
            JSON.stringify(input.macros as JsonObject),
            retailPrice,
            costPrice,
            retailPrice,
            imageUrl,
            input.isActive,
          ],
        )
      : await db.query(
          `insert into public.products
             (title, category_id, day_assignment, quantity, product_category,
              ingredients, macros, base_price, cost_price, retail_price, image_url, is_active)
           values ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9, $10, $11, $12)
           returning *`,
          [
            input.title,
            categoryId,
            dayAssignment,
            quantity,
            productCategory,
            JSON.stringify(ingredients),
            JSON.stringify(input.macros as JsonObject),
            retailPrice,
            costPrice,
            retailPrice,
            imageUrl,
            input.isActive,
          ],
        );
    return serialize<ProductRow>(result.rows[0]);
  } catch (error) {
    if (error instanceof PosActionError) throw error;
    throw normalizeDatabaseError(error as { message?: string });
  }
}

export async function localDeleteProduct(
  userId: string,
  input: DeleteProductInput,
): Promise<ProductRow> {
  await assertRole(userId, ["ADMIN"]);
  const db = await getLocalDb();
  try {
    const result = await db.query(
      "delete from public.products where id = $1 returning *",
      [input.productId],
    );
    if (!result.rows[0]) {
      throw new PosActionError("PRODUCT_NOT_FOUND", "Product not found.");
    }
    return serialize<ProductRow>(result.rows[0]);
  } catch (error) {
    if (error instanceof PosActionError) throw error;
    throw normalizeDatabaseError(error as { message?: string });
  }
}

export async function localAddExpense(
  userId: string,
  input: CreateExpenseInput,
): Promise<ExpenseRow> {
  await assertRole(userId, ["ADMIN"]);
  const db = await getLocalDb();
  try {
    const result = await db.query(
      `insert into public.expenses
         (category, supplier, amount, remark, expense_date, added_by)
       values ($1, $2, $3, $4, $5::timestamptz, $6)
       returning *`,
      [
        input.category,
        input.supplier,
        input.amount,
        input.remark ?? null,
        input.expenseDate ?? new Date().toISOString(),
        userId,
      ],
    );
    if (!result.rows[0]) {
      throw new PosActionError("EMPTY_RESULT", "Expense was not saved.");
    }
    return serialize<ExpenseRow>(result.rows[0]);
  } catch (error) {
    if (error instanceof PosActionError) throw error;
    throw normalizeDatabaseError(error as { message?: string });
  }
}

export async function localGetDeliverySettings(): Promise<DeliverySettingsRow> {
  const db = await getLocalDb();
  const result = await db.query(
    "select * from public.delivery_settings where id = true",
  );
  if (!result.rows[0]) {
    throw new PosActionError("EMPTY_RESULT", "Delivery settings were not found.");
  }
  return serialize<DeliverySettingsRow>(result.rows[0]);
}

export async function localLoadDashboardData(
  userId: string,
): Promise<DashboardData> {
  const db = await getLocalDb();
  const actor = await localGetActor(userId);

  const [
    usersResult,
    productsResult,
    categoriesResult,
    settingsResult,
    transitionsResult,
    allOrdersResult,
    allHistoryResult,
    allEventsResult,
  ] = await Promise.all([
    db.query("select * from public.app_users order by name"),
    db.query("select * from public.products order by title"),
    db.query("select * from public.categories order by sort_order"),
    db.query("select * from public.delivery_settings where id = true"),
    db.query("select * from public.order_status_transitions"),
    db.query("select * from public.orders order by created_at desc limit 50"),
    db.query(
      "select * from public.order_status_history order by created_at desc limit 100",
    ),
    db.query(
      "select * from public.order_audit_events order by created_at desc limit 100",
    ),
  ]);

  // Expenses are Master Admin P&L data. Non-admin dashboard payloads never
  // receive expense rows, even in local mode.
  const expensesResult =
    actor.role === "ADMIN"
      ? await db.query(
          "select * from public.expenses order by expense_date desc, created_at desc limit 100",
        )
      : { rows: [] as AnyRow[] };

  const users = serialize<AppUserRow[]>(usersResult.rows);
  const userMap = new Map(users.map((user) => [user.id, user]));
  const drivers = users
    .filter((user) => user.role === "DRIVER" && user.status === "ACTIVE")
    .map(toDirectoryUser);
  const customers = users
    .filter((user) => user.role === "CUSTOMER" && user.status === "ACTIVE")
    .map(toDirectoryUser);

  let orderRows = allOrdersResult.rows as AnyRow[];
  if (actor.role === "CUSTOMER") {
    orderRows = orderRows.filter((row) => row.customer_id === userId);
  } else if (actor.role === "DRIVER") {
    orderRows = orderRows.filter((row) => row.driver_id === userId);
  }

  const orders: DashboardOrder[] = await Promise.all(
    orderRows.map(async (row) => {
      const order = toOrder(row);
      const [itemsResult, historyResult, eventsResult] = await Promise.all([
        db.query("select * from public.order_items where order_id = $1", [order.id]),
        db.query(
          "select * from public.order_status_history where order_id = $1 order by created_at desc",
          [order.id],
        ),
        db.query(
          "select * from public.order_audit_events where order_id = $1 order by created_at desc",
          [order.id],
        ),
      ]);
      const customer = userMap.get(order.customer_id);
      const driver = order.driver_id ? userMap.get(order.driver_id) : undefined;
      return {
        ...order,
        order_items: serialize(itemsResult.rows),
        order_status_history: serialize(historyResult.rows),
        order_audit_events: serialize(eventsResult.rows),
        customer: customer ? toDirectoryUser(customer) : null,
        driver: driver ? toDirectoryUser(driver) : null,
      };
    }),
  );

  const visibleOrderIds = new Set(orders.map((order) => order.id));
  const history = serialize<any[]>(allHistoryResult.rows).filter((entry: any) =>
    visibleOrderIds.has(entry.order_id),
  );
  const events = serialize<any[]>(allEventsResult.rows).filter((entry: any) =>
    visibleOrderIds.has(entry.order_id),
  );

  return {
    actor,
    users,
    drivers,
    customers,
    orders,
    products: serialize<ProductRow[]>(productsResult.rows),
    expenses: serialize<ExpenseRow[]>(expensesResult.rows),
    categories: serialize<CategoryRow[]>(categoriesResult.rows),
    settings: serialize<DeliverySettingsRow>(settingsResult.rows[0]),
    transitions: serialize<OrderStatusTransitionRow[]>(transitionsResult.rows),
    history,
    events,
    generatedAt: new Date().toISOString(),
    schema: "local-pglite",
    roleLabels: ROLE_LABELS,
  };
}
