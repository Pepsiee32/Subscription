export type BillingFrequency = 'monthly' | 'yearly';

export interface Subscription {
  id: string;
  user_id: string;
  name: string;
  amount_ars: number;
  frequency: BillingFrequency;
  start_date: string;
  active: boolean;
  created_at: string;
}

export interface UpcomingCharge {
  subscriptionId: string;
  name: string;
  amountArs: number;
  date: Date;
}
