import { redirect } from "next/navigation";

/** The digital menu lives at `/`; keep `/menu` working for shared links. */
export default function MenuPage() {
  redirect("/");
}
