import { Subscription, UpcomingCharge } from '../types/subscription';

const MONTH_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function clampDay(year: number, month: number, day: number) {
  const maxDay = new Date(year, month + 1, 0).getDate();
  return Math.min(day, maxDay);
}

export function buildUpcomingCharges(subscriptions: Subscription[], year: number): UpcomingCharge[] {
  const charges: UpcomingCharge[] = [];

  for (const subscription of subscriptions) {
    const start = new Date(subscription.start_date);
    const startMonth = start.getMonth();
    const startDay = start.getDate();

    if (subscription.frequency === 'monthly') {
      for (let month = 0; month < 12; month += 1) {
        charges.push({
          subscriptionId: subscription.id,
          name: subscription.name,
          amountArs: Number(subscription.amount_ars),
          date: new Date(year, month, clampDay(year, month, startDay)),
        });
      }
    } else {
      charges.push({
        subscriptionId: subscription.id,
        name: subscription.name,
        amountArs: Number(subscription.amount_ars),
        date: new Date(year, startMonth, clampDay(year, startMonth, startDay)),
      });
    }
  }

  return charges.sort((a, b) => a.date.getTime() - b.date.getTime());
}

export function monthSummary(charges: UpcomingCharge[]) {
  return MONTH_LABELS.map((label, month) => {
    const monthCharges = charges.filter((charge) => charge.date.getMonth() === month);
    const total = monthCharges.reduce((acc, charge) => acc + charge.amountArs, 0);
    return { label, count: monthCharges.length, total };
  });
}

export function filterFromToday(charges: UpcomingCharge[]) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return charges.filter((charge) => charge.date >= today);
}

export function formatDate(date: Date) {
  return date.toLocaleDateString('es-AR');
}

export function formatArs(value: number) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(value);
}
