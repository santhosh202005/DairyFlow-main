export interface Customer {
  id: string;
  name: string;
  phone: string;
  address: string;
  username?: string;
  password?: string;
  default_rate?: number;
  created_at: string;
}

export interface MilkEntry {
  id: string;
  customer_id: string;
  customer_name: string;
  date: string;
  shift: 'AM' | 'PM';
  liters: number;
  rate: number;
  amount: number;
  created_at: string;
}

export interface Advance {
  id: string;
  customer_id: string;
  customer_name: string;
  date: string;
  amount: number;
  type: 'advance' | 'deduction';
  created_at: string;
}

export interface FeedType {
  id: string;
  name: string;
  rate: number;
  created_at: string;
}

export interface FeedPurchase {
  id: string;
  customer_id: string;
  customer_name: string;
  feed_type_id: string;
  feed_name: string;
  date: string;
  quantity: number;
  amount: number;
  created_at: string;
}

export interface Stats {
  totalCustomers: number;
  todaySupply: number;
  todayAM: number;
  todayPM: number;
  monthlyRevenue: number;
  monthlyFeed?: number;
  pendingPayments: number;
}

export interface BillingRecord {
  customer_id: string;
  name: string;
  total_liters: number;
  total_amount: number;
  total_advance: number;
  total_feed: number;
  final_payable: number;
}
