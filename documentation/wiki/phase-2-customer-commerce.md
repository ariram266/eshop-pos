# Phase 2: Customer Commerce

Customer commerce reuses Product, Customer, Order, Payment, and KDS concepts while exposing only customer-visible catalog data.

Customer records are scoped by organization and external identity. Customer APIs must never return supplier costs, internal notes, margins, batches, or accounting data. Pickup and delivery orders use transactional stock reservation and server-side payment state.
