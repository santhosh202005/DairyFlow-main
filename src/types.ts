export interface Vendor {
  id: string;
  name: string;
  username: string;
  phone?: string;
  address?: string;
  customer_count?: number;
  created_at: string;
}
export interface Worker {
  id: string;
  vendor_id: string;
  name: string;
  username: string;
  password?: string;
  phone?: string;
  today_supply?: number;
  salary_amount?: number;  // monthly salary
  daily_wage?: number;     // daily wage rate
  bank_name?: string;
  account_number?: string;
  ifsc_code?: string;
  upi_id?: string;
  created_at: string;
}

export interface WorkerAttendance {
  id: string;
  worker_id: string;
  worker_name?: string;
  date: string;
  shift?: 'AM' | 'PM' | 'full';
  status: 'present' | 'absent';
  created_at: string;
}

export interface WorkerSalarySummary {
  worker_id: string;
  worker_name: string;
  monthly_salary: number;
  daily_wage: number;
  total_working_days: number;
  present_days: number;
  absent_days: number;
  per_day_salary: number;
  salary_deduction: number;
  final_salary: number;
}
export interface Customer {
  id: string;
  name: string;
  phone: string;
  address: string;
  username?: string;
  password?: string;
  default_rate?: number;
  cattle_feed_reduction?: number;
  gender?: 'male' | 'female';
  vendor_id?: string;
  customer_code?: string;
  bank_name?: string;
  account_number?: string;
  ifsc_code?: string;
  upi_id?: string;
  created_at: string;
}

export interface MilkEntry {
  id: string;
  customer_id: string;
  customer_name: string;
  worker_id?: string;
  worker_name?: string;
  fat?: number;
  snf?: number;
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
  cattle_feed_reduction?: number;
  pendingPayments: number;
}

export interface BillingRecord {
  customer_id: string;
  name: string;
  total_liters: number;
  total_amount: number;
  total_advance: number;
  total_deduction: number;
  total_feed: number;
  cattle_feed_reduction: number;
  net_cattle_feed: number;
  remaining_feed_balance: number;
  final_payable: number;
  advance_balance: number;
}

