# Agent rules

- Payment creation and verification run only in edge functions (create-checkout, confirm-order); the browser never sets prices or marks orders paid — prevents tampering.
- Remaining stock is computed by the `item_remaining` DB function from paid + recent pending orders — single source of truth for caps.
- Owner access is checked via `user_roles` + `has_role`, never client-side flags.
