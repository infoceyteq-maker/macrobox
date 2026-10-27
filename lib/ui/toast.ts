"use client";

import { toast } from "sonner";

/** Neumorphic-themed global return messages for POS and customer flows. */
export const notify = {
  success(title: string, description?: string) {
    return toast.success(title, description ? { description } : undefined);
  },
  error(title: string, description?: string) {
    return toast.error(title, description ? { description } : undefined);
  },
  info(title: string, description?: string) {
    return toast.info(title, description ? { description } : undefined);
  },
  warning(title: string, description?: string) {
    return toast.warning(title, description ? { description } : undefined);
  },
  loading(title: string, description?: string) {
    return toast.loading(title, description ? { description } : undefined);
  },
  dismiss(id?: string | number) {
    return toast.dismiss(id);
  },
};
