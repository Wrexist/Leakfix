# Legal pages — review before launch

`/terms`, `/privacy`, and `/refunds` were drafted on 2026-09-25 from what the code
actually does. They are **drafts**: have a lawyer review them for your
jurisdiction before you take real payments.

## Decisions already made

- **14-day money-back guarantee** on the one-time report and the first Pro payment.
  Refunds are manual (Stripe dashboard). Refunding does **not** revoke the unlock
  automatically; delete the `entitlements` row by hand if you want it locked again.

## Fill in before launch

1. **Legal entity and address.** The pages say "LeakFix". Add your company name,
   registered address, and (EU/UK) company number to the terms and privacy pages.
2. **Governing law and venue.** Not stated today. Add a clause for your jurisdiction.
3. **Contact address.** Set `NEXT_PUBLIC_CONTACT_EMAIL`, or the pages fall back to
   "reply to any email we have sent you".
4. **Data retention.** Scans and leads are kept indefinitely today. Decide a period
   (for example, delete unpaid scans after 12 months) and state it in `/privacy`.
5. **EU/UK specifics.** If you have EU/UK customers: name a data controller,
   the transfer mechanism for US processors (Stripe, Resend, hosting), and
   consumer withdrawal-right wording for digital content in `/refunds`.
6. **Processors.** Keep the list in `/privacy` in sync with the services you
   actually enable (e.g. if you switch email provider or host).
7. **Postal address for marketing email** (`LEAKFIX_POSTAL_ADDRESS`) — required by
   CAN-SPAM before follow-up emails can send.

## When the text changes

Update `LEGAL_UPDATED` in `src/components/legal/LegalPage.tsx`.
