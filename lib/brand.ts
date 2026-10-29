/** Supplied brand constants — do not alter copy or logo lettering. */
export const BRAND = {
  sage: "#8B9A74",
  charcoal: "#2E3033",
  cream: "#F7F6F2",
  catalogBackground: "#DCE6DA",
  interactive: "#8FBC8F",
  interactiveDeep: "#7CA982",
} as const;

export const CONTACT_LINE =
  "WhatsApp: +94 75 1752218 | Email: ++[macrobox.food@gmail.com](mailto:macrobox.food@gmail.com)++";

/** Structured customer contact actions, using the supplied MacroBox number and email. */
export const CUSTOMER_CONTACT = {
  phoneDisplay: "+94 75 175 2218",
  phoneHref: "tel:+94751752218",
  whatsappHref: "https://wa.me/94751752218",
  email: "macrobox.food@gmail.com",
  emailHref: "mailto:macrobox.food@gmail.com",
} as const;
