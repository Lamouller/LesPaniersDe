// Placeholder types — regenerate via `supabase gen types typescript --local > lib/types/database.ts`

export type UserRole = 'client' | 'producer' | 'admin';

export type PaymentMethod = 'cash' | 'card' | 'transfer' | 'check';

export type PaymentStatus = 'pending' | 'paid' | 'overdue';

export type OrderStatus = 'draft' | 'confirmed' | 'cancelled';

export type DeliveryStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';

export interface Entity {
  id: string;
  name: string;
  address: string;
  city: string;
  postal_code: string;
  lat?: number;
  lng?: number;
  contact_email?: string;
  contact_phone?: string;
  created_at: string;
  updated_at: string;
}

export interface Producer {
  id: string;
  name: string;
  description?: string;
  phone_e164?: string;
  whatsapp_phone_id?: string;
  whatsapp_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string; // auth.users FK
  role: UserRole;
  entity_id?: string;
  producer_id?: string;
  full_name?: string;
  phone_e164?: string;
  allergies?: string[];
  notify_email: boolean;
  notify_whatsapp: boolean;
  notify_push: boolean;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  producer_id: string;
  name: string;
  description?: string;
  unit: string; // e.g. "kg", "pièce", "botte"
  created_at: string;
}

export interface WeeklyCatalogItem {
  product_id: string;
  product?: Product;
  quantity_available?: number;
  price_cents: number;
  label?: string;
}

export interface WeeklyCatalog {
  id: string;
  producer_id: string;
  producer?: Producer;
  week_start: string; // ISO date YYYY-MM-DD
  deadline: string; // ISO datetime
  is_open: boolean;
  max_orders?: number;
  items: WeeklyCatalogItem[];
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  product?: Product;
  quantity: number;
  unit_price_cents: number;
}

export interface Order {
  id: string;
  client_id: string;
  entity_id: string;
  entity?: Entity;
  catalog_id: string;
  catalog?: WeeklyCatalog;
  status: OrderStatus;
  total_cents: number;
  items?: OrderItem[];
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: string;
  order_id: string;
  order?: Order;
  client_id: string;
  amount_cents: number;
  status: PaymentStatus;
  method?: PaymentMethod;
  reference?: string;
  due_date?: string;
  reconciled_at?: string;
  reconciled_by?: string;
  created_at: string;
  updated_at: string;
}

export interface Delivery {
  id: string;
  producer_id: string;
  producer?: Producer;
  week_start: string;
  status: DeliveryStatus;
  planned_at?: string;
  started_at?: string;
  completed_at?: string;
  entity_ids: string[];
  created_at: string;
}

export interface DeliveryTrackingPoint {
  id: string;
  delivery_id: string;
  lat: number;
  lng: number;
  recorded_at: string;
}
