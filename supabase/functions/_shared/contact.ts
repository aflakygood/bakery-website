// Shared by the checkout form and the edge functions so both validate contact details the same way.
// Local part allows the usual unquoted characters (incl. "+" aliases) but rejects
// things like parentheses, commas or quotes that are almost always typos.
export const EMAIL_RE = /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@([a-z0-9-]+\.)+[a-z]{2,}$/i;
export const US_PHONE_RE = /^[2-9]\d{2}[2-9]\d{6}$/;
