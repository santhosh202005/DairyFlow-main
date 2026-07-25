export type AuthRole = 'admin' | 'customer' | 'vendor' | 'worker';

export type StoredAuth = {
  token: string;
  role: AuthRole;
  customerId?: string;
  customerName?: string;
  customerCode?: string;
  defaultRate?: number;
  customerPhone?: string;
  customerAddress?: string;
  customerGender?: 'male' | 'female';
  vendorId?: string;
  vendorName?: string;
  vendorPhone?: string;
  vendorAddress?: string;
  workerId?: string;
  workerName?: string;
  workerPhone?: string;
  profilePicture?: string;
};

const KEYS = {
  token: 'dairy_auth_token',
  role: 'dairy_auth_role',
  customerId: 'dairy_auth_customer_id',
  customerName: 'dairy_auth_customer_name',
  customerCode: 'dairy_auth_customer_code',
  defaultRate: 'dairy_auth_default_rate',
  customerPhone: 'dairy_auth_customer_phone',
  customerAddress: 'dairy_auth_customer_address',
  customerGender: 'dairy_auth_customer_gender',
  vendorId: 'dairy_auth_vendor_id',
  vendorName: 'dairy_auth_vendor_name',
  vendorPhone: 'dairy_auth_vendor_phone',
  vendorAddress: 'dairy_auth_vendor_address',
  workerId: 'dairy_auth_worker_id',
  workerName: 'dairy_auth_worker_name',
  workerPhone: 'dairy_auth_worker_phone',
  profilePicture: 'dairy_auth_profile_picture',
  language: 'dairy_app_language',
} as const;

export function loadStoredAuth(): StoredAuth | null {
  const token = localStorage.getItem(KEYS.token);
  const role = localStorage.getItem(KEYS.role) as AuthRole | null;
  if (!token || !role) return null;

  const customerId = localStorage.getItem(KEYS.customerId) || undefined;
  const customerName = localStorage.getItem(KEYS.customerName) || undefined;
  const customerCode = localStorage.getItem(KEYS.customerCode) || undefined;
  const defaultRateRaw = localStorage.getItem(KEYS.defaultRate);
  const defaultRate = defaultRateRaw ? Number(defaultRateRaw) : undefined;
  const customerPhone = localStorage.getItem(KEYS.customerPhone) || undefined;
  const customerAddress = localStorage.getItem(KEYS.customerAddress) || undefined;
  const customerGender = localStorage.getItem(KEYS.customerGender) as 'male' | 'female' | null;
  const vendorId = localStorage.getItem(KEYS.vendorId) || undefined;
  const vendorName = localStorage.getItem(KEYS.vendorName) || undefined;
  const vendorPhone = localStorage.getItem(KEYS.vendorPhone) || undefined;
  const vendorAddress = localStorage.getItem(KEYS.vendorAddress) || undefined;
  const workerId = localStorage.getItem(KEYS.workerId) || undefined;
  const workerName = localStorage.getItem(KEYS.workerName) || undefined;
  const workerPhone = localStorage.getItem(KEYS.workerPhone) || undefined;
  const profilePicture = localStorage.getItem(KEYS.profilePicture) || undefined;

  return {
    token,
    role,
    customerId,
    customerName,
    customerCode,
    defaultRate: Number.isFinite(defaultRate as number) ? defaultRate : undefined,
    customerPhone,
    customerAddress,
    customerGender: customerGender || undefined,
    vendorId,
    vendorName,
    vendorPhone,
    vendorAddress,
    workerId,
    workerName,
    workerPhone,
    profilePicture,
  };
}

export function storeAuth(auth: StoredAuth) {
  localStorage.setItem(KEYS.token, auth.token);
  localStorage.setItem(KEYS.role, auth.role);

  if (auth.customerId) localStorage.setItem(KEYS.customerId, auth.customerId);
  else localStorage.removeItem(KEYS.customerId);

  if (auth.customerName) localStorage.setItem(KEYS.customerName, auth.customerName);
  else localStorage.removeItem(KEYS.customerName);

  if (auth.customerCode) localStorage.setItem(KEYS.customerCode, auth.customerCode);
  else localStorage.removeItem(KEYS.customerCode);

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

  if (auth.vendorId) localStorage.setItem(KEYS.vendorId, auth.vendorId);
  else localStorage.removeItem(KEYS.vendorId);

  if (auth.vendorName) localStorage.setItem(KEYS.vendorName, auth.vendorName);
  else localStorage.removeItem(KEYS.vendorName);

  if (auth.vendorPhone) localStorage.setItem(KEYS.vendorPhone, auth.vendorPhone);
  else localStorage.removeItem(KEYS.vendorPhone);

  if (auth.vendorAddress) localStorage.setItem(KEYS.vendorAddress, auth.vendorAddress);
  else localStorage.removeItem(KEYS.vendorAddress);

  if (auth.workerId) localStorage.setItem(KEYS.workerId, auth.workerId);
  else localStorage.removeItem(KEYS.workerId);

  if (auth.workerName) localStorage.setItem(KEYS.workerName, auth.workerName);
  else localStorage.removeItem(KEYS.workerName);

  if (auth.workerPhone) localStorage.setItem(KEYS.workerPhone, auth.workerPhone);
  else localStorage.removeItem(KEYS.workerPhone);

  if (auth.profilePicture) localStorage.setItem(KEYS.profilePicture, auth.profilePicture);
  else localStorage.removeItem(KEYS.profilePicture);
}

export function clearAuth() {
  localStorage.removeItem(KEYS.token);
  localStorage.removeItem(KEYS.role);
  localStorage.removeItem(KEYS.customerId);
  localStorage.removeItem(KEYS.customerName);
  localStorage.removeItem(KEYS.customerCode);
  localStorage.removeItem(KEYS.defaultRate);
  localStorage.removeItem(KEYS.customerPhone);
  localStorage.removeItem(KEYS.customerAddress);
  localStorage.removeItem(KEYS.customerGender);
  localStorage.removeItem(KEYS.vendorId);
  localStorage.removeItem(KEYS.vendorName);
  localStorage.removeItem(KEYS.vendorPhone);
  localStorage.removeItem(KEYS.vendorAddress);
  localStorage.removeItem(KEYS.workerId);
  localStorage.removeItem(KEYS.workerName);
  localStorage.removeItem(KEYS.workerPhone);
  localStorage.removeItem(KEYS.profilePicture);
}

export function getStoredLanguage(): string | null {
  return localStorage.getItem(KEYS.language);
}

export function setStoredLanguage(lang: string | null) {
  if (lang) localStorage.setItem(KEYS.language, lang);
  else localStorage.removeItem(KEYS.language);
}

