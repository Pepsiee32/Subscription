export type BillingFrequency = 'monthly' | 'yearly';
export type SubscriptionCategory = 'Entretenimiento' | 'Productividad' | 'Lifestyle' | 'Utilidad' | 'Finanzas' | 'Salud' | 'Gaming' | 'Otros';
/** Ciclo de vida en UI; se persiste en columnas `status`, `active` y `cancel_from`. */
export type SubscriptionLifecycleStatus = 'active' | 'cancelled' | 'archived';

export interface Subscription {
  id: string;
  user_id: string;
  name: string;
  amount_ars: number;
  category: SubscriptionCategory | null;
  image_url: string | null;
  avatar_color: string | null;
  frequency: BillingFrequency;
  start_date: string;
  active: boolean;
  cancel_from: string | null;
  /** Preferido; si falta (datos viejos), derivar de `active`. */
  status?: SubscriptionLifecycleStatus;
  created_at: string;
}

export interface UpcomingCharge {
  subscriptionId: string;
  name: string;
  amountArs: number;
  date: Date;
}
