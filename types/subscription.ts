export type BillingFrequency = 'monthly' | 'yearly';
export type SubscriptionCategory = 'Entretenimiento' | 'Productividad' | 'Lifestyle' | 'Utilidad' | 'Finanzas' | 'Salud' | 'Gaming' | 'Otros';

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
  created_at: string;
}

export interface UpcomingCharge {
  subscriptionId: string;
  name: string;
  amountArs: number;
  date: Date;
}
