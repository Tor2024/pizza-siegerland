// Базовые типы для всего приложения

export interface Topping {
  id: string;
  name: { de: string; ru: string };
  price: number;
}

export interface MenuItem {
  id: string;
  image: string;
  name: { de: string; ru: string };
  desc: { de: string; ru: string };
  prices?: { [size: string]: number };
  price?: number;
  toppings: Topping[];
  allergens?: string[];
  allergensDesc?: { de: string; ru: string };
  available?: boolean;
  sizes?: { [size: string]: number };
  description?: { de: string; ru: string };
}

export interface Category {
  id: string;
  name: { de: string; ru: string };
  items: MenuItem[];
}

  export interface MenuData {
  categories?: { [key: string]: Category };
  offers?: Offer[];
  settings?: {
    delivery?: {
      minOrder?: number;
      freeDeliveryThreshold?: number;
      deliveryFee?: number;
      estimatedTime?: string;
    };
    googleMapsApiKey?: string;
    hours?: {
      mon_thu?: string;
      fri_sat?: string;
      sun?: string;
    };
    promoCodes?: {
      [key: string]: { discount: number; active: boolean };
    };
  };
  legal?: {
    impressum?: {
      companyName?: string;
      owner?: string;
      address?: string;
      phone?: string;
      email?: string;
      ustId?: string;
      steuernummer?: string;
      registerCourt?: string;
      registerNumber?: string;
      responsibleForContent?: string;
      responsibleAddress?: string;
      additionalInfo?: string;
    };
    datenschutz?: {
      intro?: string;
      controller?: string;
      dataCollected?: string;
      purpose?: string;
      hosting?: string;
      cookies?: string;
      rights?: string;
      additionalInfo?: string;
    };
    agb?: {
      companyName?: string;
      intro?: string;
      scope?: string;
      contractFormation?: string;
      prices?: string;
      delivery?: string;
      payment?: string;
      retentionOfTitle?: string;
      warranty?: string;
      liability?: string;
      rightOfWithdrawal?: string;
      dataProtection?: string;
      finalProvisions?: string;
      additionalInfo?: string;
    };
  };
  _source?: 'github' | 'local';
  _timestamp?: number;
}

export interface Offer {
  id: string;
  img: string;
  title: { de: string; ru: string };
  desc: { de: string; ru: string };
  price: string;
  badge?: string;
}

export interface CartItem {
  id: string;
  name: { de: string; ru: string };
  size: string;
  price: number;
  quantity: number;
  toppings: Topping[];
  image: string;
}

export interface OrderItem {
  id: string;
  name: { de: string; ru: string };
  size?: string;
  price: number;
  quantity: number;
  toppings?: Topping[];
  image?: string;
}

export interface OrderCustomer {
  name: string;
  phone: string;
  address: string;
  email?: string;
  note?: string;
}

export interface Order {
  id: string;
  items: OrderItem[];
  customer: OrderCustomer;
  total: number;
  subtotal: number;
  deliveryFee: number;
  status: 'received' | 'confirmed' | 'preparing' | 'delivering' | 'done' | 'cancelled';
  createdAt: number;
  updatedAt?: number;
  paymentMethod?: string;
  deliveryTime?: string;
  promoCode?: string;
  promoDiscount?: number;
  confirmationToken?: string;
  confirmedAt?: number;
  estimatedDelivery?: string;
  statusHistory?: Array<{ status: string; timestamp: number; note?: string }>;
}
