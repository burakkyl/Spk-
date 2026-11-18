import { Capacitor } from '@capacitor/core';
import { PrivacyScreen } from '@capgo/capacitor-privacy-screen';
import { Purchases } from '@revenuecat/purchases-capacitor';

const state = { native: false, ready: false, premium: false, packages: {}, error: '' };
const entitlementId = 'premium';
const apiKeys = {
  android: import.meta.env.VITE_RC_ANDROID_API_KEY || '',
  ios: import.meta.env.VITE_RC_IOS_API_KEY || '',
};
function notify() {
  document.dispatchEvent(new Event('duzey-billing-changed'));
}
function packageFor(plan) {
  return state.packages[plan] || null;
}
function packagePlan(pkg) {
  const type = String(pkg?.packageType || '').toLowerCase();
  const identifier = String(pkg?.identifier || '').toLowerCase();
  if (type.includes('week') || identifier.includes('week')) return 'weekly';
  if (type.includes('month') || identifier.includes('month')) return 'monthly';
  if (type.includes('lifetime') || identifier.includes('lifetime')) return 'lifetime';
  return null;
}
function updateEntitlement(customerInfo) {
  state.premium = Boolean(customerInfo?.entitlements?.active?.[entitlementId]);
  notify();
}
let configured = false;
async function init() {
  state.native = Capacitor.isNativePlatform();
  if (!state.native) return;
  try {
    await PrivacyScreen.enable({
      android: { preventScreenshots: true, dimBackground: true, privacyModeOnActivityHidden: 'splash' },
      ios: { blurEffect: 'dark' },
    });
  } catch (error) {
    console.warn('Privacy screen could not be enabled:', error);
  }
  await loadStore();
}
async function loadStore() {
  const platform = Capacitor.getPlatform();
  const apiKey = apiKeys[platform];
  if (!apiKey) {
    state.error = `Set VITE_RC_${platform.toUpperCase()}_API_KEY in the build environment.`;
    notify();
    return;
  }

  try {
    if (!configured) {
      await Purchases.configure({ apiKey, appUserID: null });
      configured = true;
      Purchases.addCustomerInfoUpdateListener((customerInfo) => updateEntitlement(customerInfo)).catch(() => {});
    }
    state.error = '';
    const [offeringsResult, customerResult] = await Promise.all([
      Purchases.getOfferings(),
      Purchases.getCustomerInfo(),
    ]);
    const packages = offeringsResult?.current?.availablePackages || [];
    for (const item of packages) {
      const plan = packagePlan(item);
      if (plan) state.packages[plan] = item;
    }
    state.ready = true;
    updateEntitlement(customerResult?.customerInfo);
    notify();
  } catch (error) {
    state.error = error?.message || 'Store billing could not be initialized.';
    console.error('Düzey billing initialization failed:', error);
    notify();
  }
}

window.DuzeyBilling = {
  get ready() { return state.ready; },
  get native() { return state.native; },
  get error() { return state.error; },
  hasPremium: () => state.premium,
  canPurchase: (plan) => state.ready && Boolean(packageFor(plan)),
  getPrice: (plan) => {
    const product = packageFor(plan)?.product;
    return product?.priceString || product?.localizedPriceString || '';
  },
  purchase: async (plan) => {
    const item = packageFor(plan);
    if (!state.ready || !item) throw new Error('This store product is not configured.');
    const result = await Purchases.purchasePackage({ aPackage: item });
    updateEntitlement(result?.customerInfo);
    if (!state.premium) throw new Error('The premium entitlement was not returned by the store.');
    window.dispatchEvent(new CustomEvent('duzey-purchase-complete', { detail: { plan } }));
    return result;
  },
  reload: () => (state.native ? loadStore() : Promise.resolve()),
  restore: async () => {
    if (!state.ready) throw new Error('Purchases are not configured.');
    const result = await Purchases.restorePurchases();
    updateEntitlement(result?.customerInfo);
    return result;
  },
};

window.addEventListener('duzey-purchase-complete', () => {
  const toast = document.getElementById('toast');
  if (toast) {
    toast.textContent = 'Düzey Plus erişimin etkinleştirildi.';
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3200);
  }
});

init();
