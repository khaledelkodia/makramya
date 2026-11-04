export type ProductColor = { name: string; hex: string };
export type Product = {
  id: string;
  slug: string;
  name: string;
  category: string;
  description: string;
  price: number;
  image_url: string | null;
  style_key: "wall" | "curtain" | "decor";
  colors: ProductColor[];
  sizes: string[];
  inventory_count: number;
  track_inventory: boolean;
  badge: string | null;
  status: "active" | "draft" | "archived";
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type OrderStatus = "new" | "confirmed" | "in_progress" | "shipped" | "completed" | "cancelled";
export type Order = {
  id: string;
  order_number: number;
  customer_name: string;
  phone: string;
  address: string;
  notes: string;
  status: OrderStatus;
  subtotal: number;
  delivery_fee: number;
  total: number;
  created_at: string;
  updated_at: string;
};
export type OrderItem = { id: string; order_id: string; product_id: string | null; product_name: string; unit_price: number; color: string; size: string; quantity: number; line_total: number };

export type StaffRole = "owner" | "manager" | "products" | "orders";
export const staffRoleLabels: Record<StaffRole, string> = {
  owner: "مسؤولة كاملة",
  manager: "مديرة المتجر",
  products: "إدارة المنتجات",
  orders: "إدارة الطلبات",
};
export const staffRoleDescriptions: Record<StaffRole, string> = {
  owner: "كل الصلاحيات، بما فيها إدارة المستخدمين.",
  manager: "إدارة المنتجات والطلبات، من غير إدارة المستخدمين.",
  products: "إضافة المنتجات وحذفها ورفع صورها فقط.",
  orders: "عرض الطلبات وتحديث حالتها فقط.",
};

export type Database = {
  public: {
    Tables: {
      admins: { Row: { user_id: string; role: StaffRole; created_at: string }; Insert: { user_id: string; role: StaffRole; created_at?: string }; Update: Partial<{ role: StaffRole }>; Relationships: [] };
      products: { Row: Product; Insert: Omit<Product, "id" | "created_at" | "updated_at"> & { id?: string; created_at?: string; updated_at?: string }; Update: Partial<Omit<Product, "id" | "created_at">>; Relationships: [] };
      orders: { Row: Order; Insert: Omit<Order, "id" | "order_number" | "created_at" | "updated_at">; Update: Partial<Pick<Order, "status" | "updated_at">>; Relationships: [] };
      order_items: { Row: OrderItem; Insert: Omit<OrderItem, "id">; Update: Partial<Pick<OrderItem, "color" | "size" | "quantity">>; Relationships: [] };
    };
    Views: Record<string, never>;
    Functions: { place_order: { Args: { p_customer_name: string; p_phone: string; p_address: string; p_notes: string; p_items: { product_id: string; color: string; size: string; quantity: number }[] }; Returns: string } };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type CartItem = { product: Product; color: ProductColor; size: string; quantity: number };
