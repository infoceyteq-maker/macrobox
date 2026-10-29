import { redirect } from "next/navigation";

/** Order tracking lives at `/orders`; keep `/track` working for shared links. */
export default function TrackPage() {
  redirect("/orders");
}
