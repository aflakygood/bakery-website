// Shared by the checkout form and the edge functions so both validate contact details the same way.
export const EMAIL_RE = /^[^\s@]+@([^\s@.]+\.)+[a-z]{2,}$/i;
export const US_PHONE_RE = /^[2-9]\d{2}[2-9]\d{6}$/;
