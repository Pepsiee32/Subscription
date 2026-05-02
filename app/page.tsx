'use client';

import { useEffect, useMemo, useState } from 'react';
import { Session, SupabaseClient, User } from '@supabase/supabase-js';
import { hasSupabaseEnv, supabase } from '../lib/supabase';
import { formatArs } from '../lib/schedule';
import { Subscription, SubscriptionLifecycleStatus } from '../types/subscription';

/** Cabecera del calendario: semana empieza en lunes (ISO). */
const WEEK_DAYS = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'];
const MONTH_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const CATEGORY_OPTIONS = ['Entretenimiento', 'Productividad', 'Lifestyle', 'Utilidad', 'Finanzas', 'Salud', 'Gaming', 'Otros'] as const;
const POPULAR_SUBSCRIPTIONS = [
  { name: 'YouTube Premium', category: 'Entretenimiento', imageUrl: '/icons/youtube.svg', color: '#FF0000' },
  { name: 'Netflix', category: 'Entretenimiento', imageUrl: '/icons/netflix.svg', color: '#E50914' },
  { name: 'Spotify', category: 'Entretenimiento', imageUrl: '/icons/spotify.svg', color: '#1DB954' },
  { name: 'Disney+', category: 'Entretenimiento', imageUrl: '/icons/disneyplus.svg', color: '#113CCF' },
  { name: 'HBO Max', category: 'Entretenimiento', imageUrl: '/icons/hbomax.svg', color: '#000000' },
  { name: 'Paramount+', category: 'Entretenimiento', imageUrl: '/icons/paramountplus.svg', color: '#0064FF' },
  { name: 'Prime Video', category: 'Entretenimiento', imageUrl: '/icons/primevideo.svg', color: '#00A8E1' },
  { name: 'Apple TV+', category: 'Entretenimiento', imageUrl: '/icons/appletv.svg', color: '#000000' },
  { name: 'ChatGPT Plus', category: 'Productividad', imageUrl: '/icons/openai.svg', color: '#10A37F' },
  { name: 'Notion', category: 'Productividad', imageUrl: '/icons/notion.svg', color: '#6D6D6D' },
  { name: 'Google One', category: 'Utilidad', imageUrl: '/icons/googleone.svg', color: '#4285F4' },
  { name: 'Microsoft 365', category: 'Productividad', imageUrl: '/icons/microsoft365.svg', color: '#D83B01' },
  { name: 'PlayStation Plus', category: 'Gaming', imageUrl: '/icons/playstation.svg', color: '#003791' },
  { name: 'Movistar', category: 'Utilidad', imageUrl: '/icons/movistar.svg', color: '#019DF4' },
  { name: 'Claro', category: 'Utilidad', imageUrl: '/icons/claro.svg', color: '#DA291C' },
  { name: 'Personal', category: 'Utilidad', imageUrl: '/icons/personal.svg', color: '#E2007A' },
  { name: 'Xbox', category: 'Gaming', imageUrl: '/icons/xbox.svg', color: '#107C10' },
  { name: 'Gemini', category: 'Productividad', imageUrl: '/icons/googlegemini.svg', color: '#4285F4' },
  { name: 'Claude', category: 'Productividad', imageUrl: '/icons/anthropic.svg', color: '#D97757' },
  { name: 'Pedidos Ya', category: 'Lifestyle', imageUrl: '/icons/pedidosya.svg', color: '#D52B1E' },
  { name: 'Rappi', category: 'Lifestyle', imageUrl: '/icons/rappi.svg', color: '#FF441F' },
  { name: 'Uber One', category: 'Utilidad', imageUrl: '/icons/uber.svg', color: '#000000' },
  { name: 'Canva', category: 'Productividad', imageUrl: '/icons/canva.svg', color: '#00C4CC' },
  { name: 'iCloud+', category: 'Utilidad', imageUrl: '/icons/icloud.svg', color: '#3693F3' },
  { name: 'Meli+', category: 'Lifestyle', imageUrl: '/icons/meli.svg', color: '#FFE600' },
  { name: 'Sport Club', category: 'Salud', imageUrl: '/icons/sportclub.svg', color: '#009639' },
  { name: 'Megatlon', category: 'Salud', imageUrl: '/icons/megatlon.svg', color: '#E31E24' },
  { name: 'OnFit', category: 'Salud', imageUrl: '/icons/onfit.svg', color: '#2563EB' },
  { name: 'Club La Nación', category: 'Lifestyle', imageUrl: '/icons/clublanacion.svg', color: '#1E3A5F' },
  { name: 'Clarín 365', category: 'Lifestyle', imageUrl: '/icons/clarin365.svg', color: '#E31B23' },
] as const;

/** Primeros en la grilla; el resto va alfabético. */
const FEATURED_POPULAR_NAMES = [
  'YouTube Premium',
  'Spotify',
  'Netflix',
  'Disney+',
  'HBO Max',
  'Prime Video',
  'Apple TV+',
  'ChatGPT Plus',
] as const;

type PopularPreset = (typeof POPULAR_SUBSCRIPTIONS)[number];

function orderPopularForPicker(items: readonly PopularPreset[], search: string): PopularPreset[] {
  const q = search.trim().toLowerCase();
  const filtered = items.filter((item) => item.name.toLowerCase().includes(q));
  const byName = new Map(filtered.map((item) => [item.name, item]));
  const featuredSet = new Set<string>(FEATURED_POPULAR_NAMES as readonly string[]);
  const featured: PopularPreset[] = [];
  for (const name of FEATURED_POPULAR_NAMES) {
    const item = byName.get(name);
    if (item) featured.push(item);
  }
  const rest = filtered
    .filter((item) => !featuredSet.has(item.name))
    .sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
  return [...featured, ...rest];
}

const AVATAR_COLOR_OPTIONS = ['#EF4444', '#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#F97316', '#14B8A6', '#6B7280'] as const;

function toDateOnlyString(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function clampDay(year: number, month: number, day: number) {
  const maxDay = new Date(year, month + 1, 0).getDate();
  return Math.min(day, maxDay);
}

function toCsvValue(value: string | number) {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

function isValidHexColor(value: string) {
  return /^#([0-9A-F]{3}|[0-9A-F]{6})$/i.test(value);
}

function normalizeLifecycleStatus(s: Pick<Subscription, 'status' | 'active'>): SubscriptionLifecycleStatus {
  if (s.status === 'active' || s.status === 'cancelled' || s.status === 'archived') return s.status;
  return s.active ? 'active' : 'cancelled';
}

function frequencyLabel(f: Subscription['frequency']) {
  return f === 'monthly' ? 'Mensual' : 'Anual';
}

function billingDayOfMonth(startDateIso: string) {
  const d = new Date(`${startDateIso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return '—';
  return String(d.getDate());
}

/** Cantidad de celdas vacías antes del día 1 cuando la primera columna es lunes. */
function leadingBlankDaysMondayFirst(year: number, month: number) {
  const jsDay = new Date(year, month, 1).getDay();
  return (jsDay + 6) % 7;
}

function pickDisplayName(user: User) {
  const meta = user.user_metadata as Record<string, unknown> | undefined;
  const fromMeta = [meta?.full_name, meta?.name, meta?.display_name].find((v) => typeof v === 'string' && String(v).trim());
  if (fromMeta) return String(fromMeta).trim();
  const email = user.email?.trim() ?? '';
  if (email.includes('@')) return email.split('@')[0] ?? 'Usuario';
  return email || 'Usuario';
}

function formatDayLongWeekday(calendarDay: number, monthIndex: number, year: number) {
  const d = new Date(year, monthIndex, calendarDay);
  const s = d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function HomePage() {
  if (!hasSupabaseEnv || !supabase) {
    return (
      <main style={styles.main}>
        <section style={styles.card}>
          <h1 style={styles.title}>Config faltante</h1>
          <p style={styles.muted}>Definí NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local</p>
        </section>
      </main>
    );
  }

  const client = supabase;
  const [session, setSession] = useState<Session | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);

  useEffect(() => {
    client.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoadingSession(false);
    });

    const { data } = client.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession);
    });

    return () => data.subscription.unsubscribe();
  }, []);

  if (loadingSession) {
    return <main style={styles.main}>Cargando...</main>;
  }

  return (
    <main style={session ? styles.mainDashboard : styles.main}>
      {session ? (
        <Dashboard
          userId={session.user.id}
          profile={{
            displayName: pickDisplayName(session.user),
            email: session.user.email ?? '',
          }}
          client={client}
        />
      ) : (
        <AuthForm client={client} />
      )}
    </main>
  );
}

function AuthForm({ client }: { client: SupabaseClient }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function signIn() {
    if (!supabase) return;
    setBusy(true);
    setMessage('');
    const { error } = await client.auth.signInWithPassword({ email: email.trim(), password });
    if (error) setMessage(error.message);
    setBusy(false);
  }

  async function signUp() {
    if (!supabase) return;
    setBusy(true);
    setMessage('');
    const { error } = await client.auth.signUp({ email: email.trim(), password });
    setMessage(error ? error.message : 'Cuenta creada. Si corresponde, confirmala por email.');
    setBusy(false);
  }

  return (
    <section style={styles.card}>
      <h1 style={styles.title}>Suscripciones</h1>
      <p style={styles.muted}>Login con email/password</p>
      <input style={styles.input} placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input
        style={styles.input}
        placeholder="Password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <button style={styles.primaryBtn} onClick={signIn} disabled={busy}>
        {busy ? 'Procesando...' : 'Iniciar sesión'}
      </button>
      <button style={styles.secondaryBtn} onClick={signUp} disabled={busy}>
        Crear cuenta
      </button>
      {message ? <p style={styles.muted}>{message}</p> : null}
    </section>
  );
}

function Dashboard({
  userId,
  profile,
  client,
}: {
  userId: string;
  profile: {
    displayName: string;
    email: string;
  };
  client: SupabaseClient;
}) {
  const [items, setItems] = useState<Subscription[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<(typeof CATEGORY_OPTIONS)[number]>('Otros');
  const [imageUrl, setImageUrl] = useState('');
  const [avatarColor, setAvatarColor] = useState<string>('#3B82F6');
  const today = useMemo(() => new Date(), []);
  const minMonthDate = useMemo(() => new Date(today.getFullYear(), today.getMonth(), 1), [today]);
  const maxMonthDate = useMemo(() => new Date(today.getFullYear() + 1, today.getMonth(), 1), [today]);
  const [cursorDate, setCursorDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [swipeStartX, setSwipeStartX] = useState<number | null>(null);
  const [isAddSheetOpen, setIsAddSheetOpen] = useState(false);
  const [daySheetView, setDaySheetView] = useState<'overview' | 'pick' | 'subscriptionDetail'>('overview');
  const [addStep, setAddStep] = useState<'pick' | 'details'>('pick');
  const [serviceSearch, setServiceSearch] = useState('');
  const [detailSubscriptionId, setDetailSubscriptionId] = useState<string | null>(null);

  async function loadData() {
    const { data, error: fetchError } = await client
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .order('start_date', { ascending: true });

    if (fetchError) setError(fetchError.message);
    else {
      const rows = (data as Subscription[]) ?? [];
      setItems(rows.map((row) => ({ ...row, status: normalizeLifecycleStatus(row) })));
    }
  }

  function mapDbError(message: string) {
    if (message.includes('schema cache')) {
      return 'Falta migrar la base de datos. En Supabase → SQL Editor ejecutá el archivo supabase/migrations/002_sync_all_subscription_columns.sql y recargá la app.';
    }
    if (message.includes('status') && (message.includes('column') || message.includes('does not exist'))) {
      return 'Falta la columna status (u otras). Ejecutá supabase/migrations/002_sync_all_subscription_columns.sql en el SQL Editor y recargá.';
    }
    return message;
  }

  useEffect(() => {
    void loadData();
  }, []);

  const calendarYear = cursorDate.getFullYear();
  const calendarMonth = cursorDate.getMonth();

  useEffect(() => {
    if (selectedDay === null) return;
    const maxDay = new Date(calendarYear, calendarMonth + 1, 0).getDate();
    if (selectedDay > maxDay) setSelectedDay(maxDay);
  }, [calendarMonth, calendarYear, selectedDay]);

  function canGoPrevMonth() {
    return cursorDate.getTime() > minMonthDate.getTime();
  }

  function canGoNextMonth() {
    return cursorDate.getTime() < maxMonthDate.getTime();
  }

  function moveMonth(offset: number) {
    const next = new Date(cursorDate.getFullYear(), cursorDate.getMonth() + offset, 1);
    if (next < minMonthDate || next > maxMonthDate) return;
    setCursorDate(next);
  }

  const isViewingCurrentMonth = calendarYear === today.getFullYear() && calendarMonth === today.getMonth();

  function goToCurrentMonth() {
    setCursorDate(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDay(today.getDate());
  }

  async function createSubscription() {
    if (selectedDay === null) return;
    const parsedAmount = Number(amount.replace(',', '.'));
    if (!name.trim() || Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Completá nombre y monto válido');
      return;
    }

    const startDate = toDateOnlyString(new Date(calendarYear, calendarMonth, selectedDay));
    setBusy(true);
    const { error: insertError } = await client.from('subscriptions').insert({
      user_id: userId,
      name: name.trim(),
      amount_ars: parsedAmount,
      category,
      image_url: imageUrl.trim() || null,
      avatar_color: isValidHexColor(avatarColor) ? avatarColor : '#3B82F6',
      frequency: 'monthly',
      start_date: startDate,
      active: true,
      status: 'active',
    });

    if (insertError) {
      setError(mapDbError(insertError.message));
      setBusy(false);
      return;
    }

    setName('');
    setAmount('');
    setCategory('Otros');
    setImageUrl('');
    setAvatarColor('#3B82F6');
    setError('');
    setBusy(false);
    await loadData();
    setAddStep('pick');
    setServiceSearch('');
    setDaySheetView('overview');
  }

  async function applyLifecycleStatus(next: SubscriptionLifecycleStatus) {
    if (!detailSubscriptionId) return;
    setBusy(true);
    setError('');
    const patch: Record<string, unknown> = { status: next };
    if (next === 'active') {
      patch.active = true;
      patch.cancel_from = null;
    } else if (next === 'cancelled') {
      patch.active = false;
      patch.cancel_from = toDateOnlyString(new Date(calendarYear, calendarMonth, 1));
    } else {
      patch.active = false;
      patch.cancel_from = null;
    }
    const { error: upErr } = await client.from('subscriptions').update(patch).eq('id', detailSubscriptionId).eq('user_id', userId);
    if (upErr) {
      setError(mapDbError(upErr.message));
      setBusy(false);
      return;
    }
    setBusy(false);
    await loadData();
  }

  const monthlyCharges = useMemo(() => {
    const monthCharges: Array<{
      name: string;
      amountArs: number;
      category: string | null;
      imageUrl: string | null;
      avatarColor: string | null;
      subscriptionId: string;
      date: Date;
      cancelFrom: string | null;
    }> = [];

    for (const subscription of items) {
      if (normalizeLifecycleStatus(subscription) === 'archived') continue;
      const start = new Date(`${subscription.start_date}T00:00:00`);
      const displayMonthDate = new Date(calendarYear, calendarMonth, 1);
      if (displayMonthDate < new Date(start.getFullYear(), start.getMonth(), 1)) continue;
      if (subscription.cancel_from) {
        const cancelFromDate = new Date(`${subscription.cancel_from}T00:00:00`);
        if (displayMonthDate >= new Date(cancelFromDate.getFullYear(), cancelFromDate.getMonth(), 1)) continue;
      }

      const day = clampDay(calendarYear, calendarMonth, start.getDate());
      monthCharges.push({
        name: subscription.name,
        amountArs: Number(subscription.amount_ars),
        category: subscription.category,
        imageUrl: subscription.image_url,
        avatarColor: subscription.avatar_color,
        subscriptionId: subscription.id,
        date: new Date(calendarYear, calendarMonth, day),
        cancelFrom: subscription.cancel_from,
      });
    }

    return monthCharges;
  }, [items, calendarMonth, calendarYear]);

  const monthTotal = useMemo(() => monthlyCharges.reduce((acc, charge) => acc + charge.amountArs, 0), [monthlyCharges]);
  const lifecycleStats = useMemo(() => {
    let active = 0;
    let cancelled = 0;
    let archived = 0;
    for (const s of items) {
      const st = normalizeLifecycleStatus(s);
      if (st === 'active') active += 1;
      else if (st === 'cancelled') cancelled += 1;
      else archived += 1;
    }
    return { active, cancelled, archived, total: items.length };
  }, [items]);
  const detailSubscription = useMemo(
    () => (detailSubscriptionId ? items.find((s) => s.id === detailSubscriptionId) : undefined),
    [items, detailSubscriptionId]
  );
  const calendarCells = useMemo(() => {
    const leading = leadingBlankDaysMondayFirst(calendarYear, calendarMonth);
    const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
    const cells: Array<number | null> = [];
    for (let i = 0; i < leading; i += 1) cells.push(null);
    for (let day = 1; day <= daysInMonth; day += 1) cells.push(day);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [calendarMonth, calendarYear]);
  const chargesByDay = useMemo<
    Map<
      number,
      {
        name: string;
        amountArs: number;
        category: string | null;
        imageUrl: string | null;
        avatarColor: string | null;
        subscriptionId: string;
        cancelFrom: string | null;
      }[]
    >
  >(() => {
    const map = new Map<
      number,
      {
        name: string;
        amountArs: number;
        category: string | null;
        imageUrl: string | null;
        avatarColor: string | null;
        subscriptionId: string;
        cancelFrom: string | null;
      }[]
    >();
    for (const charge of monthlyCharges) {
      const day = charge.date.getDate();
      const current = map.get(day) ?? [];
      current.push({
        name: charge.name,
        amountArs: charge.amountArs,
        category: charge.category,
        imageUrl: charge.imageUrl,
        avatarColor: charge.avatarColor,
        subscriptionId: charge.subscriptionId,
        cancelFrom: charge.cancelFrom,
      });
      map.set(day, current);
    }
    return map;
  }, [monthlyCharges]);
  const selectedDayCharges = selectedDay ? chargesByDay.get(selectedDay) ?? [] : [];
  const selectedDayTotal = useMemo(
    () => selectedDayCharges.reduce((acc, c) => acc + c.amountArs, 0),
    [selectedDayCharges]
  );

  function closeDaySheet() {
    setIsAddSheetOpen(false);
    setDaySheetView('overview');
    setAddStep('pick');
    setServiceSearch('');
    setDetailSubscriptionId(null);
    setError('');
  }

  function backToDayOverview() {
    setDaySheetView('overview');
    setAddStep('pick');
    setServiceSearch('');
    setDetailSubscriptionId(null);
    setError('');
  }

  function exportMonthCsv() {
    const rows = monthlyCharges
      .slice()
      .sort((a, b) => a.date.getTime() - b.date.getTime() || a.name.localeCompare(b.name))
      .map((charge) =>
        [
          toDateOnlyString(charge.date),
          charge.name,
          charge.category ?? '',
          charge.amountArs,
          charge.cancelFrom ? `cortada_desde_${charge.cancelFrom}` : 'activa',
        ].map((value) => toCsvValue(value)).join(',')
      );

    const csv = ['fecha,nombre,categoria,monto_ars,estado', ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `suscripciones-${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function applyPopularTemplate(templateName: string) {
    const preset = POPULAR_SUBSCRIPTIONS.find((item) => item.name === templateName);
    if (!preset) return;
    setName(preset.name);
    setCategory(preset.category as (typeof CATEGORY_OPTIONS)[number]);
    setImageUrl(preset.imageUrl);
    setAvatarColor(preset.color);
    setAddStep('details');
  }

  const popularPickerSections = useMemo(() => {
    const ordered = orderPopularForPicker(POPULAR_SUBSCRIPTIONS, serviceSearch);
    const featuredSet = new Set<string>(FEATURED_POPULAR_NAMES as readonly string[]);
    const splitIndex = ordered.findIndex((item) => !featuredSet.has(item.name));
    const popular = splitIndex === -1 ? ordered : ordered.slice(0, splitIndex);
    const allServices = splitIndex === -1 ? [] : ordered.slice(splitIndex);
    return { popular, allServices };
  }, [serviceSearch]);

  function pickNewServiceFromSearch() {
    const trimmed = serviceSearch.trim();
    if (!trimmed) return;
    setName(trimmed);
    setImageUrl('');
    setAvatarColor('#3B82F6');
    setCategory('Otros');
    setAddStep('details');
  }

  const calendarRowCount = Math.ceil(calendarCells.length / 7);
  const profileInitial = (profile.displayName.trim().slice(0, 1) || profile.email.trim().slice(0, 1) || '?').toUpperCase();

  return (
    <section style={styles.mobileContainer}>
      <div style={styles.topBar}>
        <div style={styles.topBarLeft}>
          <p style={styles.muted}>All Subs</p>
          <h1 style={styles.titleCompact}>
            {MONTH_LABELS[calendarMonth]}, {calendarYear}
          </h1>
          <p style={styles.totalAmountCompact}>{formatArs(monthTotal)}</p>
        </div>
        <details style={styles.profileDetails}>
          <summary style={styles.profileSummary} aria-label="Menú de cuenta">
            <span style={styles.profileAvatar}>{profileInitial}</span>
          </summary>
          <div style={styles.profileMenu} role="menu">
            <div style={styles.profileMenuHeader}>
              <p style={styles.profileDisplayName}>{profile.displayName}</p>
              <p style={styles.profileEmail} title={profile.email}>
                {profile.email || 'Sin email'}
              </p>
            </div>
            <div style={styles.profileStats}>
              <p style={styles.profileStatLine}>
                <span style={styles.profileStatLabel}>Mes visible</span>
                <span style={styles.profileStatValue}>
                  {MONTH_LABELS[calendarMonth]} {calendarYear}
                </span>
              </p>
              <p style={styles.profileStatLine}>
                <span style={styles.profileStatLabel}>Total mes</span>
                <span style={styles.profileStatValue}>{formatArs(monthTotal)}</span>
              </p>
              <p style={styles.profileStatLine}>
                <span style={styles.profileStatLabel}>Activas</span>
                <span style={styles.profileStatValue}>{lifecycleStats.active}</span>
              </p>
              <p style={styles.profileStatLine}>
                <span style={styles.profileStatLabel}>Canceladas</span>
                <span style={styles.profileStatValue}>{lifecycleStats.cancelled}</span>
              </p>
              <p style={styles.profileStatLine}>
                <span style={styles.profileStatLabel}>Archivadas</span>
                <span style={styles.profileStatValue}>{lifecycleStats.archived}</span>
              </p>
              <p style={styles.profileStatLine}>
                <span style={styles.profileStatLabel}>Total en base</span>
                <span style={styles.profileStatValue}>{lifecycleStats.total}</span>
              </p>
              <p style={styles.profileStatsHint}>
                Canceladas: entran al calendario hasta el mes de baja. Archivadas: no se muestran en el calendario; el registro queda en la base.
              </p>
            </div>
            <button type="button" style={styles.profileMenuBtn} onClick={exportMonthCsv} role="menuitem">
              Exportar CSV
            </button>
            <button
              type="button"
              style={styles.profileMenuBtnDanger}
              onClick={() => client.auth.signOut()}
              role="menuitem"
            >
              Cerrar sesión
            </button>
          </div>
        </details>
      </div>

      <div style={styles.monthNav}>
        <button type="button" style={styles.navBtn} onClick={() => moveMonth(-1)} disabled={!canGoPrevMonth()}>
          {'<'}
        </button>
        <span style={styles.monthLabel}>
          {MONTH_LABELS[calendarMonth]} {calendarYear}
        </span>
        <button type="button" style={styles.navBtn} onClick={() => moveMonth(1)} disabled={!canGoNextMonth()}>
          {'>'}
        </button>
        {!isViewingCurrentMonth ? (
          <button type="button" style={styles.todayMonthBtn} onClick={goToCurrentMonth}>
            Hoy
          </button>
        ) : null}
      </div>

      <div
        style={styles.calendarCard}
        onTouchStart={(event) => {
          setSwipeStartX(event.changedTouches[0]?.clientX ?? null);
        }}
        onTouchEnd={(event) => {
          if (swipeStartX === null) return;
          const endX = event.changedTouches[0]?.clientX ?? swipeStartX;
          const deltaX = endX - swipeStartX;
          if (deltaX > 40) moveMonth(-1);
          if (deltaX < -40) moveMonth(1);
          setSwipeStartX(null);
        }}
      >
        <div style={styles.calendarWeekHeader}>
          {WEEK_DAYS.map((weekDay) => (
            <div key={weekDay} style={styles.calendarWeekCell}>
              {weekDay}
            </div>
          ))}
        </div>

        <div style={{ ...styles.calendarGrid, gridTemplateRows: `repeat(${calendarRowCount}, minmax(0, 1fr))` }}>
          {calendarCells.map((day, idx) => {
            const dayCharges = day ? chargesByDay.get(day) ?? [] : [];
            const isSelected = day !== null && day === selectedDay;
            return (
              <button
                type="button"
                key={`${day ?? 'empty'}-${idx}`}
                style={{
                  ...styles.calendarCell,
                  ...(isSelected ? styles.calendarCellSelected : {}),
                  ...(day === null ? styles.calendarCellEmpty : {}),
                }}
                onClick={() => {
                  if (day !== null) {
                    setSelectedDay(day);
                    setIsAddSheetOpen(true);
                    setDaySheetView('overview');
                    setAddStep('pick');
                    setServiceSearch('');
                    setDetailSubscriptionId(null);
                    setError('');
                  }
                }}
                disabled={day === null}
              >
                {day ? (
                  <>
                    <div style={styles.calendarDayRow}>
                      <span style={styles.calendarDay}>{day}</span>
                    </div>
                    <div style={styles.calendarCellBody}>
                      {dayCharges[0] ? (
                        <div style={styles.calendarAvatarCluster}>
                          <div style={styles.calendarCellAvatar} aria-hidden>
                            {dayCharges[0].imageUrl ? (
                              <img src={dayCharges[0].imageUrl} alt="" style={styles.calendarCellAvatarImage} />
                            ) : (
                              <span
                                style={{
                                  ...styles.calendarAvatarFallback,
                                  background: isValidHexColor(dayCharges[0].avatarColor ?? '')
                                    ? (dayCharges[0].avatarColor as string)
                                    : '#3B82F6',
                                  fontSize: 14,
                                }}
                              >
                                {dayCharges[0].name.slice(0, 1).toUpperCase()}
                              </span>
                            )}
                          </div>
                          {dayCharges.length > 1 ? (
                            <span
                              style={styles.calendarMoreBadgeBelow}
                              aria-label={
                                dayCharges.length === 2
                                  ? '1 suscripción más'
                                  : `${dayCharges.length - 1} suscripciones más`
                              }
                            >
                              +{dayCharges.length - 1}
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      {isAddSheetOpen && selectedDay !== null ? (
        <div style={styles.modalOverlay}>
          <div style={styles.bottomSheet}>
            {daySheetView === 'overview' ? (
              <>
                <div style={styles.daySheetOverviewHeader}>
                  <div style={styles.daySheetHeaderSpacer} />
                  <div style={styles.daySheetHeaderTitles}>
                    <h2 style={styles.daySheetMainTitle}>Suscripciones</h2>
                    <p style={styles.daySheetDateLine}>
                      {formatDayLongWeekday(selectedDay, calendarMonth, calendarYear)}
                    </p>
                  </div>
                  <button type="button" style={styles.secondaryBtn} onClick={closeDaySheet}>
                    Cerrar
                  </button>
                </div>

                <div style={styles.addSheetScroll}>
                  {selectedDayCharges.length === 0 ? (
                    <p style={{ ...styles.muted, textAlign: 'center', margin: '12px 0 8px' }}>
                      No hay suscripciones este día.
                    </p>
                  ) : null}
                  {selectedDayCharges.map((charge, idx) => (
                    <div key={`${charge.subscriptionId}-${idx}`} style={styles.dayChargeBlock}>
                      <button
                        type="button"
                        style={styles.daySubscriptionRow}
                        onClick={() => {
                          setDetailSubscriptionId(charge.subscriptionId);
                          setDaySheetView('subscriptionDetail');
                        }}
                      >
                        <div style={styles.daySubscriptionAvatar}>
                          {charge.imageUrl ? (
                            <img src={charge.imageUrl} alt="" style={styles.daySubscriptionAvatarImg} />
                          ) : (
                            <span
                              style={{
                                ...styles.calendarAvatarFallback,
                                background: isValidHexColor(charge.avatarColor ?? '')
                                  ? (charge.avatarColor as string)
                                  : '#3B82F6',
                                fontSize: 15,
                              }}
                            >
                              {charge.name.slice(0, 1).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div style={styles.daySubscriptionText}>
                          <span style={styles.daySubscriptionName}>{charge.name}</span>
                          <span style={styles.daySubscriptionMeta}>
                            Mensual · {formatArs(charge.amountArs)}
                            {charge.category ? ` · ${charge.category}` : ''}
                          </span>
                        </div>
                        <span style={styles.daySubscriptionChevron} aria-hidden>
                          ›
                        </span>
                      </button>
                    </div>
                  ))}

                  <button
                    type="button"
                    style={styles.dayAddSubscriptionRow}
                    onClick={() => {
                      setDaySheetView('pick');
                      setAddStep('pick');
                      setServiceSearch('');
                      setDetailSubscriptionId(null);
                    }}
                  >
                    <span style={styles.dayAddCircle}>+</span>
                    <span style={styles.dayAddLabel}>Agregar suscripción</span>
                  </button>

                  {error ? <p style={styles.error}>{error}</p> : null}
                </div>

                <div style={styles.daySheetFooter}>
                  <span style={styles.daySheetFooterLabel}>Total</span>
                  <strong style={styles.daySheetFooterAmount}>{formatArs(selectedDayTotal)}</strong>
                </div>
              </>
            ) : daySheetView === 'subscriptionDetail' ? (
              <>
                <div style={styles.daySheetFlowHeader}>
                  <button type="button" style={styles.daySheetBackBtn} onClick={backToDayOverview}>
                    ← Volver
                  </button>
                  <h2 style={styles.daySheetFlowTitle}>Suscripción</h2>
                  <button type="button" style={styles.secondaryBtn} onClick={closeDaySheet}>
                    Cerrar
                  </button>
                </div>

                <div style={styles.addSheetScroll}>
                  {detailSubscription ? (
                    <>
                      <div style={styles.subDetailHero}>
                        <div style={styles.subDetailAvatarWrap}>
                          {detailSubscription.image_url ? (
                            <img src={detailSubscription.image_url} alt="" style={styles.subDetailAvatarImg} />
                          ) : (
                            <span
                              style={{
                                ...styles.calendarAvatarFallback,
                                background: isValidHexColor(detailSubscription.avatar_color ?? '')
                                  ? (detailSubscription.avatar_color as string)
                                  : '#3B82F6',
                                fontSize: 26,
                              }}
                            >
                              {detailSubscription.name.slice(0, 1).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <h3 style={styles.subDetailName}>{detailSubscription.name}</h3>
                        <p style={styles.subDetailSubtitle}>
                          {frequencyLabel(detailSubscription.frequency)} ·{' '}
                          {formatArs(Number(detailSubscription.amount_ars))}
                        </p>
                      </div>

                      <div style={styles.subDetailStatusCard}>
                        <span style={styles.subDetailStatusLabel}>Estado</span>
                        <div style={styles.subDetailStatusRow}>
                          <span
                            style={{
                              ...styles.subDetailStatusDot,
                              background:
                                normalizeLifecycleStatus(detailSubscription) === 'active'
                                  ? '#22c55e'
                                  : normalizeLifecycleStatus(detailSubscription) === 'cancelled'
                                    ? '#f97316'
                                    : '#6b7280',
                            }}
                            aria-hidden
                          />
                          <select
                            style={styles.subDetailStatusSelect}
                            value={normalizeLifecycleStatus(detailSubscription)}
                            onChange={(e) =>
                              void applyLifecycleStatus(e.target.value as SubscriptionLifecycleStatus)
                            }
                            disabled={busy}
                          >
                            <option value="active">Activo</option>
                            <option value="cancelled">Cancelado</option>
                            <option value="archived">Archivado</option>
                          </select>
                        </div>
                      </div>

                      <div style={styles.subDetailInfoCard}>
                        <div style={styles.subDetailInfoRow}>
                          <span style={styles.subDetailInfoKey}>Monto</span>
                          <span style={styles.subDetailInfoVal}>
                            {formatArs(Number(detailSubscription.amount_ars))}
                          </span>
                        </div>
                        <div style={styles.subDetailInfoRow}>
                          <span style={styles.subDetailInfoKey}>Categoría</span>
                          <span style={styles.subDetailInfoVal}>{detailSubscription.category ?? '—'}</span>
                        </div>
                        <div style={styles.subDetailInfoRow}>
                          <span style={styles.subDetailInfoKey}>Día de cargo (mes)</span>
                          <span style={styles.subDetailInfoVal}>{billingDayOfMonth(detailSubscription.start_date)}</span>
                        </div>
                        {detailSubscription.cancel_from ? (
                          <div style={styles.subDetailInfoRow}>
                            <span style={styles.subDetailInfoKey}>Baja desde</span>
                            <span style={styles.subDetailInfoVal}>{detailSubscription.cancel_from}</span>
                          </div>
                        ) : null}
                      </div>
                    </>
                  ) : (
                    <p style={{ ...styles.muted, textAlign: 'center', marginTop: 16 }}>No se encontró la suscripción.</p>
                  )}
                  {error ? <p style={styles.error}>{error}</p> : null}
                </div>
              </>
            ) : (
              <>
                <div style={styles.daySheetFlowHeader}>
                  <button type="button" style={styles.daySheetBackBtn} onClick={backToDayOverview}>
                    ← Volver
                  </button>
                  <h2 style={styles.daySheetFlowTitle}>
                    {addStep === 'pick' ? 'Agregar suscripción' : 'Completar datos'}
                  </h2>
                  <button type="button" style={styles.secondaryBtn} onClick={closeDaySheet}>
                    Cerrar
                  </button>
                </div>

                <div style={styles.addSheetScroll}>
                  {addStep === 'pick' ? (
                    <>
                      {serviceSearch.trim() ? (
                        <div style={styles.popularGrid}>
                          <button type="button" style={styles.popularCard} onClick={pickNewServiceFromSearch}>
                            <div
                              style={{ ...styles.popularAvatar, display: 'grid', placeItems: 'center', background: '#2a2a2a' }}
                            >
                              <span style={{ fontSize: 18, fontWeight: 800 }}>+</span>
                            </div>
                            <span>{serviceSearch.trim()}</span>
                          </button>
                        </div>
                      ) : null}

                      {popularPickerSections.popular.length > 0 ? (
                        <>
                          <p style={styles.pickerSectionLabel}>Servicios populares</p>
                          <div style={styles.popularGrid}>
                            {popularPickerSections.popular.map((option) => (
                              <button
                                key={option.name}
                                type="button"
                                style={styles.popularCard}
                                onClick={() => applyPopularTemplate(option.name)}
                              >
                                <div style={styles.popularAvatar}>
                                  <img src={option.imageUrl} alt={option.name} style={styles.calendarAvatarImage} />
                                </div>
                                <span>{option.name}</span>
                              </button>
                            ))}
                          </div>
                        </>
                      ) : null}

                      {popularPickerSections.allServices.length > 0 ? (
                        <>
                          <p style={styles.pickerSectionLabel}>Todos los servicios</p>
                          <div style={styles.popularGrid}>
                            {popularPickerSections.allServices.map((option) => (
                              <button
                                key={option.name}
                                type="button"
                                style={styles.popularCard}
                                onClick={() => applyPopularTemplate(option.name)}
                              >
                                <div style={styles.popularAvatar}>
                                  <img src={option.imageUrl} alt={option.name} style={styles.calendarAvatarImage} />
                                </div>
                                <span>{option.name}</span>
                              </button>
                            ))}
                          </div>
                        </>
                      ) : null}
                    </>
                  ) : (
                    <>
                      <div style={styles.headerRow}>
                        <div style={styles.serviceChip}>
                          <div style={styles.calendarAvatar}>
                            {imageUrl.trim() ? (
                              <img src={imageUrl} alt={name || 'service'} style={styles.calendarAvatarImage} />
                            ) : (
                              <span style={{ ...styles.calendarAvatarFallback, background: avatarColor }}>
                                {(name.trim().slice(0, 1) || '?').toUpperCase()}
                              </span>
                            )}
                          </div>
                          <div style={styles.serviceChipText}>
                            <strong>{name || 'Servicio'}</strong>
                            <span style={styles.muted}>{category}</span>
                          </div>
                        </div>
                        <button type="button" style={styles.secondaryBtn} onClick={() => setAddStep('pick')}>
                          Cambiar
                        </button>
                      </div>

                      <input style={styles.input} placeholder="Monto ARS" value={amount} onChange={(e) => setAmount(e.target.value)} />
                      <select
                        style={styles.input}
                        value={category}
                        onChange={(e) => setCategory(e.target.value as (typeof CATEGORY_OPTIONS)[number])}
                      >
                        {CATEGORY_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                      <div style={styles.colorPickerRow}>
                        <span style={styles.muted}>Color para inicial</span>
                        <div style={styles.colorOptions}>
                          {AVATAR_COLOR_OPTIONS.map((color) => (
                            <button
                              type="button"
                              key={color}
                              style={{
                                ...styles.colorDot,
                                background: color,
                                ...(avatarColor === color ? styles.colorDotActive : {}),
                              }}
                              onClick={() => setAvatarColor(color)}
                            />
                          ))}
                        </div>
                      </div>
                      <button style={styles.primaryBtn} onClick={createSubscription} disabled={busy}>
                        {busy ? 'Guardando...' : 'Guardar'}
                      </button>
                    </>
                  )}

                  {error ? <p style={styles.error}>{error}</p> : null}
                </div>

                {addStep === 'pick' ? (
                  <div style={styles.searchBarDock}>
                    <div style={styles.searchBar}>
                      <span style={styles.searchIcon}>⌕</span>
                      <input
                        style={styles.searchInput}
                        placeholder="Buscar servicio"
                        value={serviceSearch}
                        onChange={(e) => setServiceSearch(e.target.value)}
                      />
                      {serviceSearch ? (
                        <button type="button" style={styles.searchClearBtn} onClick={() => setServiceSearch('')}>
                          ×
                        </button>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}

const styles: Record<string, React.CSSProperties> = {
  main: {
    minHeight: '100vh',
    display: 'grid',
    placeItems: 'center',
    padding: 16,
    background: 'radial-gradient(circle at top, #2a2a2a, #121212 55%)',
  },
  mainDashboard: {
    height: '100vh',
    maxHeight: '100vh',
    overflow: 'hidden',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'stretch',
    padding: 0,
    margin: 0,
    background: 'radial-gradient(circle at top, #2a2a2a, #121212 55%)',
  },
  mobileContainer: {
    width: '100%',
    maxWidth: 430,
    height: '100%',
    maxHeight: '100%',
    padding: '12px 14px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    overflow: 'hidden',
    boxSizing: 'border-box',
  },
  topBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    flexShrink: 0,
  },
  topBarLeft: {
    minWidth: 0,
    flex: 1,
  },
  titleCompact: {
    margin: 0,
    fontSize: 22,
    letterSpacing: 0.2,
    lineHeight: 1.2,
  },
  totalAmountCompact: {
    margin: '4px 0 0',
    fontSize: 26,
    fontWeight: 700,
    lineHeight: 1.1,
  },
  profileDetails: {
    position: 'relative',
    flexShrink: 0,
  },
  profileSummary: {
    listStyle: 'none',
    cursor: 'pointer',
    borderRadius: 999,
    border: '1px solid #4a4a4a',
    padding: 0,
    width: 40,
    height: 40,
    display: 'grid',
    placeItems: 'center',
    background: '#252525',
  },
  profileAvatar: {
    fontWeight: 700,
    fontSize: 15,
    color: '#f3f3f3',
  },
  profileMenuHeader: {
    padding: '4px 8px 8px',
    borderBottom: '1px solid #2e2e2e',
  },
  profileDisplayName: {
    margin: 0,
    fontSize: 15,
    fontWeight: 700,
    color: '#f3f3f3',
    lineHeight: 1.25,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: 248,
  },
  profileEmail: {
    margin: '4px 0 0',
    fontSize: 12,
    color: '#a7a7a7',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: 248,
  },
  profileStats: {
    padding: '8px 8px 6px',
    borderBottom: '1px solid #2e2e2e',
    display: 'grid',
    gap: 6,
  },
  profileStatLine: {
    margin: 0,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: 12,
    fontSize: 12,
  },
  profileStatLabel: {
    color: '#8a8a8a',
    flexShrink: 0,
  },
  profileStatValue: {
    color: '#eaeaea',
    fontWeight: 600,
    textAlign: 'right',
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  profileStatsHint: {
    margin: '4px 0 0',
    fontSize: 10,
    lineHeight: 1.4,
    color: '#7a7a7a',
  },
  profileMenu: {
    position: 'absolute',
    right: 0,
    top: 'calc(100% + 6px)',
    minWidth: 268,
    maxWidth: 'min(92vw, 320px)',
    maxHeight: 'min(72vh, 520px)',
    overflowY: 'auto',
    padding: 6,
    borderRadius: 12,
    border: '1px solid #3a3a3a',
    background: '#1e1e1e',
    boxShadow: '0 12px 28px rgba(0,0,0,0.45)',
    zIndex: 30,
    display: 'grid',
    gap: 4,
    WebkitOverflowScrolling: 'touch',
  },
  profileMenuBtn: {
    padding: '8px 10px',
    borderRadius: 8,
    border: '1px solid transparent',
    background: 'transparent',
    color: '#f3f3f3',
    fontWeight: 600,
    fontSize: 13,
    cursor: 'pointer',
    textAlign: 'left',
  },
  profileMenuBtnDanger: {
    padding: '8px 10px',
    borderRadius: 8,
    border: '1px solid transparent',
    background: 'transparent',
    color: '#ff9e9e',
    fontWeight: 600,
    fontSize: 13,
    cursor: 'pointer',
    textAlign: 'left',
  },
  card: {
    width: '100%',
    maxWidth: 420,
    background: '#191919',
    border: '1px solid #2a2a2a',
    borderRadius: 16,
    padding: 16,
    display: 'grid',
    gap: 10,
  },
  title: {
    margin: 0,
    fontSize: 32,
    letterSpacing: 0.2,
  },
  totalAmount: {
    margin: '8px 0 0',
    fontSize: 44,
    fontWeight: 700,
  },
  subtitle: {
    margin: 0,
    fontSize: 19,
  },
  muted: {
    margin: 0,
    color: '#a7a7a7',
  },
  input: {
    width: '100%',
    padding: '11px 12px',
    borderRadius: 12,
    border: '1px solid #3a3a3a',
    background: '#141414',
    color: '#f3f3f3',
  },
  primaryBtn: {
    width: '100%',
    padding: '11px 14px',
    borderRadius: 999,
    border: '1px solid #3f3f3f',
    background: 'linear-gradient(180deg, #303030 0%, #202020 100%)',
    color: '#ffffff',
    fontWeight: 700,
    cursor: 'pointer',
  },
  secondaryBtn: {
    padding: '8px 11px',
    borderRadius: 999,
    border: '1px solid #4a4a4a',
    background: 'transparent',
    color: '#f3f3f3',
    fontWeight: 600,
    cursor: 'pointer',
  },
  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  monthNav: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    flexShrink: 0,
  },
  todayMonthBtn: {
    padding: '6px 12px',
    borderRadius: 999,
    border: '1px solid #4a4a4a',
    background: '#242424',
    color: '#e8e8e8',
    fontWeight: 600,
    fontSize: 12,
    cursor: 'pointer',
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 10,
    padding: '8px 0',
    borderBottom: '1px solid #2a2a2a',
    alignItems: 'center',
  },
  error: {
    margin: 0,
    color: '#ff9e9e',
  },
  dangerBtn: {
    padding: '6px 10px',
    borderRadius: 8,
    border: '1px solid #7d2e2e',
    background: '#3a1717',
    color: '#ffd2d2',
    fontWeight: 600,
    cursor: 'pointer',
  },
  monthLabel: {
    minWidth: 120,
    textAlign: 'center',
    fontWeight: 700,
    color: '#e0e0e0',
  },
  navBtn: {
    width: 34,
    height: 34,
    borderRadius: 999,
    border: '1px solid #3a3a3a',
    background: '#181818',
    color: '#f3f3f3',
    cursor: 'pointer',
  },
  calendarCard: {
    borderRadius: 18,
    border: '1px solid #2d2d2d',
    background: 'rgba(19,19,19,0.75)',
    padding: 10,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
  },
  calendarWeekHeader: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
    gap: 6,
    flexShrink: 0,
  },
  calendarWeekCell: {
    fontWeight: 600,
    color: '#7f7f7f',
    fontSize: 12,
    textAlign: 'center',
  },
  calendarGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
    gap: 6,
    flex: 1,
    minHeight: 0,
  },
  calendarCell: {
    minHeight: 0,
    minWidth: 0,
    width: '100%',
    boxSizing: 'border-box',
    border: '1px solid #2b2b2b',
    borderRadius: 14,
    padding: '5px 4px',
    background: '#202020',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    alignItems: 'stretch',
    overflow: 'hidden',
    color: '#d9d9d9',
    cursor: 'pointer',
  },
  calendarCellSelected: {
    border: '2px solid #d6d6d6',
    background: '#2a2a2a',
  },
  calendarCellEmpty: {
    opacity: 0.35,
    cursor: 'default',
  },
  calendarDayRow: {
    display: 'flex',
    justifyContent: 'flex-end',
    width: '100%',
    flexShrink: 0,
    minHeight: 14,
  },
  calendarDay: {
    fontSize: 11,
    lineHeight: 1,
    fontVariantNumeric: 'tabular-nums',
  },
  calendarCellBody: {
    flex: 1,
    minHeight: 0,
    minWidth: 0,
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  calendarAvatarCluster: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    flexShrink: 0,
    maxWidth: '100%',
  },
  calendarCellAvatar: {
    width: 32,
    height: 32,
    borderRadius: 999,
    background: '#2b5ca7',
    color: '#fff',
    fontSize: 14,
    display: 'grid',
    placeItems: 'center',
    fontWeight: 700,
    overflow: 'hidden',
    border: '1px solid #3a3a3a',
    flexShrink: 0,
  },
  calendarCellAvatarImage: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
    padding: 3,
  },
  calendarMoreBadgeBelow: {
    flexShrink: 0,
    height: 16,
    minWidth: 22,
    padding: '0 6px',
    borderRadius: 999,
    border: '1px solid #4a4a4a',
    background: '#353535',
    color: '#f0f0f0',
    fontSize: 10,
    fontWeight: 800,
    lineHeight: '14px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxSizing: 'border-box',
    pointerEvents: 'none',
    marginTop: 1,
  },
  calendarAvatar: {
    width: 16,
    height: 16,
    flexShrink: 0,
    borderRadius: 999,
    background: '#2b5ca7',
    color: '#fff',
    fontSize: 9,
    display: 'grid',
    placeItems: 'center',
    fontWeight: 700,
    overflow: 'hidden',
    border: '1px solid #2f2f2f',
  },
  calendarAvatarFallback: {
    width: '100%',
    height: '100%',
    display: 'grid',
    placeItems: 'center',
    color: '#fff',
    fontWeight: 700,
  },
  calendarAvatarImage: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
    padding: 2,
  },
  colorPickerRow: {
    display: 'grid',
    gap: 6,
  },
  colorOptions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
  },
  colorDot: {
    width: 22,
    height: 22,
    borderRadius: 999,
    border: '1px solid #404040',
    cursor: 'pointer',
  },
  colorDotActive: {
    outline: '2px solid #e9e9e9',
    outlineOffset: 1,
  },
  avatarPreviewRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  bottomSheet: {
    border: '1px solid #333',
    borderRadius: 18,
    background: 'linear-gradient(180deg, rgba(32,32,32,0.95), rgba(22,22,22,0.95))',
    padding: 12,
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
    maxHeight: '88vh',
    overflow: 'hidden',
    minHeight: 0,
  },
  daySheetOverviewHeader: {
    display: 'grid',
    gridTemplateColumns: 'minmax(72px, 1fr) minmax(0, 2fr) minmax(72px, 1fr)',
    alignItems: 'start',
    gap: 6,
    flexShrink: 0,
    marginBottom: 10,
  },
  daySheetHeaderSpacer: {
    minHeight: 1,
  },
  daySheetHeaderTitles: {
    textAlign: 'center',
    minWidth: 0,
  },
  daySheetMainTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 700,
    letterSpacing: 0.2,
  },
  daySheetDateLine: {
    margin: '6px 0 0',
    fontSize: 13,
    color: '#a7a7a7',
    lineHeight: 1.3,
  },
  dayChargeBlock: {
    borderRadius: 12,
    border: '1px solid #333',
    background: '#252525',
    overflow: 'hidden',
    marginBottom: 8,
  },
  daySubscriptionRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    padding: '12px 12px',
    border: 'none',
    background: 'transparent',
    color: 'inherit',
    cursor: 'pointer',
    textAlign: 'left',
    font: 'inherit',
  },
  daySubscriptionAvatar: {
    width: 40,
    height: 40,
    borderRadius: 999,
    overflow: 'hidden',
    flexShrink: 0,
    border: '1px solid #3a3a3a',
    background: '#1e1e1e',
    display: 'grid',
    placeItems: 'center',
  },
  daySubscriptionAvatarImg: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
    padding: 4,
  },
  daySubscriptionText: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
    alignItems: 'flex-start',
  },
  daySubscriptionName: {
    fontSize: 15,
    fontWeight: 700,
    lineHeight: 1.2,
  },
  daySubscriptionMeta: {
    fontSize: 12,
    color: '#a8a8a8',
    lineHeight: 1.25,
  },
  daySubscriptionChevron: {
    flexShrink: 0,
    fontSize: 22,
    color: '#888',
    lineHeight: 1,
    paddingLeft: 4,
  },
  dayAddSubscriptionRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    padding: '14px 12px',
    marginTop: 4,
    borderRadius: 12,
    border: '1px dashed #4a4a4a',
    background: 'transparent',
    color: '#eaeaea',
    cursor: 'pointer',
    font: 'inherit',
    fontWeight: 600,
    textAlign: 'left',
  },
  dayAddCircle: {
    width: 36,
    height: 36,
    borderRadius: 999,
    border: '1px solid #5a5a5a',
    display: 'grid',
    placeItems: 'center',
    fontSize: 22,
    fontWeight: 700,
    flexShrink: 0,
    background: '#2a2a2a',
  },
  dayAddLabel: {
    fontSize: 15,
    fontWeight: 600,
  },
  daySheetFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '14px 4px 6px',
    marginTop: 'auto',
    flexShrink: 0,
    borderTop: '1px solid #3a3a3a',
  },
  daySheetFooterLabel: {
    fontSize: 15,
    color: '#b0b0b0',
    fontWeight: 600,
  },
  daySheetFooterAmount: {
    fontSize: 19,
    fontWeight: 700,
    letterSpacing: 0.2,
  },
  daySheetFlowHeader: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, auto) 1fr minmax(0, auto)',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
    marginBottom: 8,
  },
  daySheetBackBtn: {
    border: 'none',
    background: 'transparent',
    color: '#c4c4c4',
    fontWeight: 600,
    fontSize: 14,
    cursor: 'pointer',
    padding: '6px 4px',
    justifySelf: 'start',
  },
  daySheetFlowTitle: {
    margin: 0,
    fontSize: 16,
    fontWeight: 700,
    textAlign: 'center',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  subDetailHero: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    marginBottom: 16,
    paddingTop: 4,
  },
  subDetailAvatarWrap: {
    width: 72,
    height: 72,
    borderRadius: 999,
    overflow: 'hidden',
    border: '1px solid #3a3a3a',
    background: '#1e1e1e',
    display: 'grid',
    placeItems: 'center',
    marginBottom: 12,
  },
  subDetailAvatarImg: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
    padding: 8,
  },
  subDetailName: {
    margin: 0,
    fontSize: 22,
    fontWeight: 700,
    letterSpacing: 0.2,
  },
  subDetailSubtitle: {
    margin: '6px 0 0',
    fontSize: 14,
    color: '#a7a7a7',
  },
  subDetailStatusCard: {
    borderRadius: 14,
    border: '1px solid #333',
    background: '#252525',
    padding: '12px 14px',
    marginBottom: 12,
  },
  subDetailStatusLabel: {
    display: 'block',
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: '#8a8a8a',
    marginBottom: 8,
  },
  subDetailStatusRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  subDetailStatusDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    flexShrink: 0,
  },
  subDetailStatusSelect: {
    flex: 1,
    minWidth: 0,
    padding: '10px 12px',
    borderRadius: 10,
    border: '1px solid #4a4a4a',
    background: '#1a1a1a',
    color: '#f3f3f3',
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
  },
  subDetailInfoCard: {
    borderRadius: 14,
    border: '1px solid #333',
    background: '#252525',
    padding: '4px 0',
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
  },
  subDetailInfoRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: 12,
    padding: '10px 14px',
    borderBottom: '1px solid #333',
  },
  subDetailInfoKey: {
    fontSize: 13,
    color: '#a0a0a0',
    flexShrink: 0,
  },
  subDetailInfoVal: {
    fontSize: 14,
    fontWeight: 600,
    color: '#ececec',
    textAlign: 'right',
    minWidth: 0,
  },
  addSheetHeader: {
    flexShrink: 0,
    marginBottom: 10,
  },
  addSheetScroll: {
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
    WebkitOverflowScrolling: 'touch',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    paddingBottom: 4,
  },
  searchBarDock: {
    flexShrink: 0,
    marginTop: 10,
    paddingTop: 10,
    borderTop: '1px solid #333',
    background: 'linear-gradient(180deg, rgba(26,26,26,0.98), rgba(22,22,22,0.99))',
  },
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.55)',
    display: 'grid',
    alignItems: 'end',
    padding: 12,
    zIndex: 20,
  },
  pickerSectionLabel: {
    margin: '10px 0 6px',
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.1em',
    color: '#8a8a8a',
    textTransform: 'uppercase',
  },
  popularGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: 8,
  },
  popularCard: {
    border: '1px solid #333',
    background: '#252525',
    color: '#f1f1f1',
    borderRadius: 12,
    padding: 10,
    display: 'grid',
    justifyItems: 'center',
    gap: 6,
    cursor: 'pointer',
  },
  popularAvatar: {
    width: 34,
    height: 34,
    borderRadius: 999,
    overflow: 'hidden',
    border: '1px solid #3a3a3a',
    background: '#1e1e1e',
    padding: 2,
    display: 'grid',
    placeItems: 'center',
  },
  searchBar: {
    border: '1px solid #3a3a3a',
    borderRadius: 999,
    background: '#1b1b1b',
    padding: '10px 12px',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  searchIcon: {
    color: '#a7a7a7',
    fontWeight: 800,
  },
  searchInput: {
    flex: 1,
    border: 'none',
    outline: 'none',
    background: 'transparent',
    color: '#f3f3f3',
    fontSize: 16,
  },
  searchClearBtn: {
    width: 28,
    height: 28,
    borderRadius: 999,
    border: '1px solid #3a3a3a',
    background: '#262626',
    color: '#f3f3f3',
    cursor: 'pointer',
    display: 'grid',
    placeItems: 'center',
    lineHeight: 1,
    fontSize: 18,
  },
  serviceChip: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  serviceChipText: {
    display: 'grid',
    gap: 2,
  },
  dayList: {
    display: 'grid',
    gap: 6,
  },
};
