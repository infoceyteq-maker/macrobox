"use client";

import { Toaster } from "sonner";

/** Global return-message layer: Order Accepted, Dispatched, Settled, etc. */
export default function ToastProvider() {
  return (
    <Toaster
      position="top-right"
      closeButton
      expand
      visibleToasts={5}
      duration={4200}
      toastOptions={{
        style: {
          background: "#F7F6F2",
          color: "#2E3033",
          border: "1px solid #d5e0d1",
          borderRadius: "1.25rem",
          boxShadow: "9px 9px 20px #c6d0c2, -9px -9px 20px #ffffff",
          fontFamily: "var(--font-poppins), sans-serif",
        },
        classNames: {
          toast: "macrobox-toast",
          title: "font-display text-sm font-bold tracking-tight text-[#2E3033]",
          description: "text-xs leading-5 text-[#5f6d64]",
          actionButton:
            "rounded-xl bg-[#8FBC8F] px-3 py-2 text-xs font-bold text-[#22301f] shadow-none",
          cancelButton:
            "rounded-xl bg-[#e5ece1] px-3 py-2 text-xs font-bold text-[#3d4a42] shadow-none",
          success: "!border-[#8FBC8F]/70",
          error: "!border-[#d9a19a]",
          info: "!border-[#9db8c6]",
          warning: "!border-[#e0c38a]",
        },
      }}
    />
  );
}
