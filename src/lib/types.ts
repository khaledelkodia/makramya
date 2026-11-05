export type ProductColor = { name: string; hex: string };
export type Product = {
  id: string;
  slug: string;
  name: string;
  category: string;
  description: string;
  price: number;
  sale_price: number | null;
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
  customer_email: string;
  customer_id: string | null;
  phone: string;
  governorate: string;
  address: string;
  notes: string;
  status: OrderStatus;
  subtotal: number;
  discount_amount: number;
  coupon_code: string | null;
  delivery_fee: number;
  total: number;
  created_at: string;
  updated_at: string;
};
export type OrderItem = { id: string; order_id: string; product_id: string | null; product_name: string; unit_price: number; color: string; size: string; quantity: number; line_total: number };
export type OrderStatusHistory = { id:string; order_id:string; status:OrderStatus; customer_note:string; created_at:string };
export type DeliverySettings = {
  id: "default";
  base_fee: number;
  delivery_zones: DeliveryZone[];
  free_shipping_threshold: number | null;
  min_delivery_days: number;
  max_delivery_days: number;
  coverage_area: string;
  customer_note: string;
  updated_by: string | null;
  updated_at: string;
};
export type DeliveryZone = { governorates:string[]; fee:number };
export type CustomerOrderTracking = {
  id:string; order_number:number; status:OrderStatus; created_at:string; updated_at:string;
  history:Pick<OrderStatusHistory,"status"|"customer_note"|"created_at">[];
};

export type StoreCoupon = {
  id: string;
  code: string;
  discount_type: "percent" | "fixed";
  discount_value: number;
  max_discount: number | null;
  minimum_subtotal: number;
  usage_limit: number | null;
  uses_count: number;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
  created_at: string;
  created_by: string | null;
};

export type CustomerCart = {
  cart_key: string;
  customer_id: string | null;
  customer_name: string;
  customer_email: string;
  phone: string;
  address: string;
  governorate: string;
  contact_consent: boolean;
  items: { product_id:string; product_name:string; image_url:string|null; color:string; size:string; quantity:number; unit_price:number; line_total:number }[];
  subtotal: number;
  status: "active" | "converted" | "closed";
  order_id: string | null;
  created_at: string;
  updated_at: string;
};

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
  orders: "إدارة الطلبات وإعدادات التوصيل.",
};

export type Database = {
  public: {
    Tables: {
      admins: { Row: { user_id: string; role: StaffRole; created_at: string }; Insert: { user_id: string; role: StaffRole; created_at?: string }; Update: Partial<{ role: StaffRole }>; Relationships: [] };
      products: { Row: Product; Insert: Omit<Product, "id" | "created_at" | "updated_at"> & { id?: string; created_at?: string; updated_at?: string }; Update: Partial<Omit<Product, "id" | "created_at">>; Relationships: [] };
      orders: { Row: Order; Insert: Omit<Order, "id" | "order_number" | "created_at" | "updated_at">; Update: Partial<Pick<Order, "status" | "updated_at">>; Relationships: [] };
      order_items: { Row: OrderItem; Insert: Omit<OrderItem, "id">; Update: Partial<Pick<OrderItem, "color" | "size" | "quantity">>; Relationships: [] };
      order_status_history: { Row: OrderStatusHistory; Insert: Omit<OrderStatusHistory, "id" | "created_at"> & { id?:string; created_at?:string }; Update: never; Relationships: [] };
      delivery_settings: { Row: DeliverySettings; Insert: Omit<DeliverySettings, "updated_at"> & { updated_at?:string }; Update: Partial<Omit<DeliverySettings, "id">>; Relationships: [] };
      category_images: { Row: { slug:string; image_url:string; updated_by:string|null; updated_at:string }; Insert: { slug:string; image_url:string; updated_by?:string|null; updated_at?:string }; Update: Partial<{ image_url:string; updated_by:string|null; updated_at:string }>; Relationships: [] };
      category_details: { Row: { slug:string; name:string; english:string; description:string; updated_by:string|null; updated_at:string }; Insert: { slug:string; name:string; english:string; description:string; updated_by?:string|null; updated_at?:string }; Update: Partial<{ name:string; english:string; description:string; updated_by:string|null; updated_at:string }>; Relationships: [] };
      store_coupons: { Row: StoreCoupon; Insert: Omit<StoreCoupon,"id"|"created_at"> & {id?:string;created_at?:string}; Update: Partial<Pick<StoreCoupon,"is_active">>; Relationships: [] };
      customer_carts: { Row: CustomerCart; Insert: never; Update: Partial<Pick<CustomerCart,"status">>; Relationships: [] };
    };
    Views: Record<string, never>;
    Functions: {
      place_order: { Args:
        | { p_customer_name: string; p_phone: string; p_address: string; p_governorate:string; p_customer_email:string; p_notes: string; p_items: { product_id: string; color: string; size: string; quantity: number }[] }
        | { p_customer_name:string; p_phone:string; p_address:string; p_governorate:string; p_customer_email:string; p_coupon_code:string; p_notes:string; p_items:{product_id:string;color:string;size:string;quantity:number}[] }
        | { p_customer_name: string; p_phone: string; p_address: string; p_governorate:string; p_notes: string; p_items: { product_id: string; color: string; size: string; quantity: number }[] };
        Returns: string };
      track_order: { Args: { p_order_id:string }; Returns: CustomerOrderTracking | null };
      track_order_by_prefix: { Args: { p_order_id_prefix:string }; Returns: CustomerOrderTracking | null };
      claim_customer_orders: { Args: Record<string, never>; Returns: number };
      update_store_category: { Args: { p_slug:string; p_name:string; p_english:string; p_description:string }; Returns: boolean };
      quote_coupon: { Args: { p_code:string; p_subtotal:number }; Returns: { valid:boolean; discount_amount:number; normalized_code:string; message:string }[] };
      save_customer_cart: { Args: { p_cart_key:string; p_items:{product_id:string;color:string;size:string;quantity:number}[]; p_customer_name?:string; p_customer_email?:string; p_phone?:string; p_address?:string; p_governorate?:string; p_contact_consent?:boolean }; Returns: undefined };
      revoke_customer_cart_contact: { Args:{p_cart_key:string}; Returns:undefined };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type CartItem = { product: Product; color: ProductColor; size: string; quantity: number };
