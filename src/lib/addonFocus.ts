// "Show me this add-on": the Selected Add-Ons tray (in the wizard's header) asks the Addons page to go to an add-on's category tab and highlight its card. The two are far
// apart in the tree and neither owns the other, so the request is a window event - one name, one detail shape, here. Imports nothing from the app.

export const ADDON_FOCUS_EVENT = 'vfq:focus-addon';

/** The DOM id of an add-on's card, which the Addons page sets and the focus request scrolls to. */
export const addonCardId = (productId: string): string => `addon-card-${productId}`;

/** Asks the Addons page to show the add-on: its category tab, its card scrolled into view and highlighted. */
export function requestAddonFocus(productId: string): void {
  window.dispatchEvent(new CustomEvent<{ productId: string }>(ADDON_FOCUS_EVENT, { detail: { productId } }));
}
