# Backup: the new-customer "Offers & Plans" start page (five start cards)

Taken 2026-11-08, before the page was replaced by the existing-customer **Recommended Offers** page (`product` step: `ProductSelection variant="buttons"` + `CrossSalesStep`, `showAllOfferTypes`).

What the page was: for a customer known to be new (`eligibility.isExistingCustomer === false`) the `productCards` step showed five cards - New Postpaid,
New Home Connection, New Fixed Line, New MNP, New Prepaid - that chose the journey, with no Continue, and Recommended Offers (`product`) was skipped.

Files (plain text, not compiled; drop the `.txt` to restore):

| Backup | Original path |
|---|---|
| `productStep.tsx.txt` | `src/modules/new-connection/steps/productStep.tsx` (`productCardsStep`, `hasNoCrossSalesOffer`, the `skip` on `product`) |
| `StartCards.tsx.txt` | `src/modules/new-connection/steps/StartCards.tsx` |
| `ProductSelection.tsx.txt` | `src/modules/new-connection/steps/ProductSelection.tsx` (the `launch` variant, `showAllOfferTypes` only for existing customers) |
| `connectionSteps.tsx.txt` | `src/modules/new-connection/connectionSteps.tsx` (`productCardsStep(ctx)` in the step list) |
| `newConnection.test.mjs.txt` | `tests/newConnection.test.mjs` (the "five start cards" test) |
| `ui-components.start-cards.css.txt` | the `.start-card`, `.primary-tile`, `.card-option-lg` rules removed from `src/ui-components.css`, if they became unused |

The same state is also recoverable from git (the last commit before this change).
