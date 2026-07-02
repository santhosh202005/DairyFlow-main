export type AuthRole = 'admin' | 'customer';

export type StoredAuth = {
  token: string;
  role: AuthRole;
  customerId?: string;
  customerName?: string;
  defaultRate?: number;
  customerPhone?: string;
  customerAddress?: string;
  customerGender?: 'male' | 'female';
};

const KEYS = {
  token: 'dairy_auth_token',
  role: 'dairy_auth_role',
  customerId: 'dairy_auth_customer_id',
  customerName: 'dairy_auth_customer_name',
  defaultRate: 'dairy_auth_default_rate',
  customerPhone: 'dairy_auth_customer_phone',
  customerAddress: 'dairy_auth_customer_address',
  customerGender: 'dairy_auth_customer_gender',
  language: 'dairy_app_language',
} as const;

export function loadStoredAuth(): StoredAuth | null {
  const token = localStorage.getItem(KEYS.token);
  const role = localStorage.getItem(KEYS.role) as AuthRole | null;
  if (!token || !role) return null;

  const customerId = localStorage.getItem(KEYS.customerId) || undefined;
  const customerName = localStorage.getItem(KEYS.customerName) || undefined;
  const defaultRateRaw = localStorage.getItem(KEYS.defaultRate);
  const defaultRate = defaultRateRaw ? Number(defaultRateRaw) : undefined;
  const customerPhone = localStorage.getItem(KEYS.customerPhone) || undefined;
  const customerAddress = localStorage.getItem(KEYS.customerAddress) || undefined;
  const customerGender = localStorage.getItem(KEYS.customerGender) as 'male' | 'female' | null;

  return {
    token,
    role,
    customerId,
    customerName,
    defaultRate: Number.isFinite(defaultRate as number) ? defaultRate : undefined,
    customerPhone,
    customerAddress,
    customerGender: customerGender || undefined,
  };
}

export function storeAuth(auth: StoredAuth) {
  localStorage.setItem(KEYS.token, auth.token);
  localStorage.setItem(KEYS.role, auth.role);

  if (auth.customerId) localStorage.setItem(KEYS.customerId, auth.customerId);
  else localStorage.removeItem(KEYS.customerId);

  if (auth.customerName) localStorage.setItem(KEYS.customerName, auth.customerName);
  else localStorage.removeItem(KEYS.customerName);

  if (auth.defaultRate !== undefined && auth.defaultRate !== null) {
    localStorage.setItem(KEYS.defaultRate, String(auth.defaultRate));
  } else {
    localStorage.removeItem(KEYS.defaultRate);
  }

  if (auth.customerPhone) localStorage.setItem(KEYS.customerPhone, auth.customerPhone);
  else localStorage.removeItem(KEYS.customerPhone);

  if (auth.customerAddress) localStorage.setItem(KEYS.customerAddress, auth.customerAddress);
  else localStorage.removeItem(KEYS.customerAddress);

  if (auth.customerGender) localStorage.setItem(KEYS.customerGender, auth.customerGender);
  else localStorage.removeItem(KEYS.customerGender);
}

export function clearAuth() {
  localStorage.removeItem(KEYS.token);
  localStorage.removeItem(KEYS.role);
  localStorage.removeItem(KEYS.customerId);
  localStorage.removeItem(KEYS.customerName);
  localStorage.removeItem(KEYS.defaultRate);
  localStorage.removeItem(KEYS.customerPhone);
  localStorage.removeItem(KEYS.customerAddress);
  localStorage.removeItem(KEYS.customerGender);
}

export function getStoredLanguage(): string | null {
  return localStorage.getItem(KEYS.language);
}

export function setStoredLanguage(lang: string | null) {
  if (lang) localStorage.setItem(KEYS.language, lang);
  else localStorage.removeItem(KEYS.language);
}

