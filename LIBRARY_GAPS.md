# Library gaps

Components and helpers the prototype still owns because they are NOT in `dxp-ui` yet. They are listed here instead of being duplicated in the library. Each is generic in shape but still carries product wording, business rules or an application dependency; when that is removed it can move to the library.

| Prototype file | Why it is not in the library yet | Needed before it can move |
|---|---|---|
| `components/primitives/ConnectionTypeTag.tsx`, `ServiceTypeTag.tsx`, `lib/serviceTypeTag.ts`, `lib/connectionType.ts` | Tags for Postpaid / Prepaid / Fixed Line / MNP: the connection types are product knowledge. | A generic `Tag` taking a tone and a label; the journey mapping stays here. |
| `components/primitives/offerCardParts.tsx`, `offerCardModel.ts` | `SelectedPlanFigure` and the offer-card model know QAR amounts and plan/pack wording. (The generic parts - `CARD_SELECTED`, `CARD_IDLE`, `CARD_HIGHLIGHT`, `SelectedTick`, `SelectedCardTexture` - are in the library and re-exported here.) | A neutral `Price` / `Figure` component without currency or plan terms. |
| `components/domain/FileImagePreview.tsx`, `DocumentCaptureActions.tsx`, `CameraCaptureButton.tsx`, `ScanFailureNotice.tsx`, `DocumentFileMeta.tsx`, `documentUploadRules.ts` | A generic upload/scan/preview toolkit, but wired to the PDF/JPG 2 MB rules and the desk-scanner engine. | Rules and scanner passed in as props; scanner engine behind an interface. |
| `components/patterns/PageHeader.tsx`, `EntityMissing.tsx`, `KeyInformationPanel.tsx` | Page-level pieces with no business logic, but they use the application's `useKindPending` / router. | Drop the data-layer coupling (take a `loading`/`missing` prop). |
| `components/patterns/wizard/*` (WizardStepPanel, WizardStepHeader, WizardFooter, StepSummarySection, CustomerViewButton) | A guided-wizard shell; generic layout, but tied to the journey draft store and the Customer view pop-up. | Separate presentational shell from the draft/mirror logic. |
| `hooks/useSubmit.ts` | One-at-a-time async submit with a toast on failure: the toast is the application's Redux notification system. | Inject the notifier. |
| `lib/format.ts`, `lib/statusTone.ts`, `lib/values.ts` | Formatting with QAR and status wording specific to the product. | Locale/currency as parameters. |
| The toast system (`stores/notificationSlice` + `ToastContainer`) | Redux based. A presentational `Toast` (no store) would belong in the library; the store stays here. | A store-free `Toast` + `ToastRegion`. |
| `components/domain/QidInput.tsx`, `ContactPhoneInput.tsx` | Qatar-specific ID and phone behaviour (QID rules, +974). | A neutral masked-number input; the QID rules stay here. |
| `lib/router.ts`, `routerHooks.ts`, `routerLinks.tsx` | The application's Next.js navigation layer. Not a design-system concern; the library receives its link through `LinkProvider`. | Nothing - stays in the application. |

Also: `Select` in `dxp-ui` discards its `placeholder` prop, so the Check RFS "Area" dropdown cannot show a watermark. Needed: an opt-in `watermark` on `Select`, like `Input`'s.

Also: the Check RFS result verdicts (the supplied layout) call for four glyphs `dxp-ui` does not have - an infinity (RFS Unlimited), a house with a signal (FWA Indoor & Outdoor), a building with a clock (Building Is RFA) and a magnifier with a cross (Not Found). The page uses the nearest existing icons (layers, installation wifi, building, search) until they are added to the library.

Also: `dxp-ui`'s `.toggle-group` (OptionToggle) is full width with equal segments, while its filter tabs (`.tab-strip-filter`) are as wide as their tabs. The application overrides it to content width and a compact 36px height (14px text) in `src/app-components.css` (`.toggle-group`, `.toggle-option`); the library's own default should become that, and the override can then go.
