export type Product = {
  id: string;
  name: string;
  default_price: number;
  reorder_at: number;
  is_active: boolean;
  created_at: string;
};

export type Channel = { id: string; name: string; created_at: string };
export type City = { id: string; name: string; created_at: string };
export type Platform = { id: string; name: string; created_at: string };
export type Discount = { id: string; label: string; pct: number; created_at: string };

export type StockRow = {
  product_id: string;
  opening_qty: number;
  current_qty: number;
  created_at: string;
};

export type SaleStatus = 'Paid' | 'Pending' | 'Free';

export type Sale = {
  id: string;
  date: string;
  ref: string;
  product_id: string;
  qty: number;
  channel_id: string | null;
  city_id: string | null;
  platform_id: string | null;
  customer: string | null;
  sale_type: string;
  unit_price: number;
  discount_id: string | null;
  discount_label: string | null;
  discount_pct: number;
  discount_amt: number;
  final_price: number;
  status: SaleStatus;
  notes: string | null;
  is_deleted: boolean;
  created_by: string;
  created_at: string;
};

export type Restock = {
  id: string;
  date: string;
  product_id: string;
  qty: number;
  supplier: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
};

export type SaleDeletion = {
  id: string;
  sale_id: string;
  deleted_at: string;
  deleted_by: string;
  sale_date: string;
  ref: string;
  product_name: string;
  qty: number;
  channel_name: string | null;
  customer: string | null;
  amount: number;
};

export type QuoteStatus = 'Draft' | 'Sent' | 'Accepted' | 'Rejected';

export type Quote = {
  id: string;
  ref: string;
  date: string;
  valid_until: string | null;
  client_name: string;
  contact: string | null;
  city_id: string | null;
  address: string | null;
  overall_discount_id: string | null;
  overall_discount_label: string | null;
  overall_discount_pct: number;
  notes: string | null;
  status: QuoteStatus;
  subtotal: number;
  discount_amt: number;
  total: number;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type QuoteItem = {
  id: string;
  quote_id: string;
  product_id: string | null;
  product_name: string;
  qty: number;
  unit_price: number;
  line_total: number;
  created_at: string;
};

export type AppUser = {
  id: string; // auth uid
  name: string;
  email: string;
  role: 'admin' | 'manager';
  created_at: string;
};

export type ActivityLog = {
  id: number;
  type: 'add' | 'del' | 'edit' | 'auth' | 'pw';
  message: string;
  actor_id: string;
  created_at: string;
};
