'use client';

import { useEffect, useMemo, useState } from 'react';
import { Session, SupabaseClient } from '@supabase/supabase-js';
import { hasSupabaseEnv, supabase } from '../lib/supabase';
import { formatArs } from '../lib/schedule';
import { Subscription } from '../types/subscription';

const WEEK_DAYS = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
const MONTH_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const CATEGORY_OPTIONS = ['Entretenimiento', 'Productividad', 'Lifestyle', 'Utilidad', 'Finanzas', 'Salud', 'Gaming', 'Otros'] as const;
const POPULAR_SUBSCRIPTIONS = [
  { name: 'YouTube Premium', category: 'Entretenimiento', imageUrl: '/icons/youtube.svg', color: '#FF0000' },
  { name: 'Netflix', category: 'Entretenimiento', imageUrl: '/icons/netflix.svg', color: '#E50914' },
  { name: 'Spotify', category: 'Entretenimiento', imageUrl: '/icons/spotify.svg', color: '#1DB954' },
  { name: 'Disney+', category: 'Entretenimiento', imageUrl: '/icons/disneyplus.svg', color: '#113CCF' },
  { name: 'ChatGPT Plus', category: 'Productividad', imageUrl: '/icons/openai.svg', color: '#10A37F' },
  { name: 'Notion', category: 'Productividad', imageUrl: '/icons/notion.svg', color: '#6D6D6D' },
  { name: 'Google One', category: 'Utilidad', imageUrl: '/icons/googleone.svg', color: '#4285F4' },
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
] as const;

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

  return <main style={styles.main}>{session ? <Dashboard userId={session.user.id} client={client} /> : <AuthForm client={client} />}</main>;
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

function Dashboard({ userId, client }: { userId: string; client: SupabaseClient }) {
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
  const [addStep, setAddStep] = useState<'pick' | 'details'>('pick');
  const [serviceSearch, setServiceSearch] = useState('');

  async function loadData() {
    const { data, error: fetchError } = await client
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .order('start_date', { ascending: true });

    if (fetchError) setError(fetchError.message);
    else setItems((data as Subscription[]) ?? []);
  }

  function mapDbError(message: string) {
    if (message.includes('schema cache')) {
      return 'Falta migrar la base de datos. Ejecutá las columnas nuevas en subscriptions (cancel_from, category, image_url) y luego recargá.';
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
    setIsAddSheetOpen(false);
    setAddStep('pick');
    setServiceSearch('');
  }

  async function deleteSubscription(subscriptionId: string) {
    setBusy(true);
    const cancelFrom = toDateOnlyString(new Date(calendarYear, calendarMonth, 1));
    const { error: deleteError } = await client
      .from('subscriptions')
      .update({
        active: false,
        cancel_from: cancelFrom,
      })
      .eq('id', subscriptionId)
      .eq('user_id', userId);
    if (deleteError) {
      setError(mapDbError(deleteError.message));
      setBusy(false);
      return;
    }
    setError('');
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
  const calendarCells = useMemo(() => {
    const firstWeekDay = new Date(calendarYear, calendarMonth, 1).getDay();
    const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
    const cells: Array<number | null> = [];
    for (let i = 0; i < firstWeekDay; i += 1) cells.push(null);
    for (let day = 1; day <= daysInMonth; day += 1) cells.push(day);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [calendarMonth]);
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

  const filteredPopularSubscriptions = useMemo(
    () =>
      POPULAR_SUBSCRIPTIONS.filter((item) =>
        item.name.toLowerCase().includes(serviceSearch.trim().toLowerCase())
      ),
    [serviceSearch]
  );

  function pickNewServiceFromSearch() {
    const trimmed = serviceSearch.trim();
    if (!trimmed) return;
    setName(trimmed);
    setImageUrl('');
    setAvatarColor('#3B82F6');
    setCategory('Otros');
    setAddStep('details');
  }

  return (
    <section style={styles.mobileContainer}>
      <div style={styles.headerRow}>
        <div>
          <p style={styles.muted}>All Subs</p>
          <h1 style={styles.title}>
            {MONTH_LABELS[calendarMonth]}, {calendarYear}
          </h1>
          <p style={styles.totalAmount}>{formatArs(monthTotal)}</p>
        </div>
        <button
          style={styles.secondaryBtn}
          onClick={() => {
            client.auth.signOut();
          }}
        >
          Salir
        </button>
      </div>

      <button type="button" style={styles.secondaryBtn} onClick={exportMonthCsv}>
        Exportar CSV del mes
      </button>

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

        <div style={styles.calendarGrid}>
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
                    setAddStep('pick');
                    setServiceSearch('');
                  }
                }}
                disabled={day === null}
              >
                {day ? (
                  <>
                    <div style={styles.calendarDay}>{day}</div>
                    <div style={styles.badgeRow}>
                      {dayCharges.slice(0, 2).map((charge, chargeIdx) => (
                        <div key={`${charge.subscriptionId}-${chargeIdx}`} style={styles.calendarAvatar}>
                          {charge.imageUrl ? (
                            <img src={charge.imageUrl} alt={charge.name} style={styles.calendarAvatarImage} />
                          ) : (
                            <span
                              style={{
                                ...styles.calendarAvatarFallback,
                                background: isValidHexColor(charge.avatarColor ?? '') ? (charge.avatarColor as string) : '#3B82F6',
                              }}
                            >
                              {charge.name.slice(0, 1).toUpperCase()}
                            </span>
                          )}
                        </div>
                      ))}
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
            <div style={styles.headerRow}>
              <h2 style={styles.subtitle}>{addStep === 'pick' ? 'Add Subscription' : `Día ${selectedDay}`}</h2>
              <button
                style={styles.secondaryBtn}
                onClick={() => {
                  setIsAddSheetOpen(false);
                  setAddStep('pick');
                  setServiceSearch('');
                }}
              >
                Cerrar
              </button>
            </div>

            {addStep === 'pick' ? (
              <>
                <div style={styles.popularGrid}>
                  {serviceSearch.trim() ? (
                    <button type="button" style={styles.popularCard} onClick={pickNewServiceFromSearch}>
                      <div style={{ ...styles.popularAvatar, display: 'grid', placeItems: 'center', background: '#2a2a2a' }}>
                        <span style={{ fontSize: 18, fontWeight: 800 }}>+</span>
                      </div>
                      <span>{serviceSearch.trim()}</span>
                    </button>
                  ) : null}

                  {filteredPopularSubscriptions.map((option) => (
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

                <div style={styles.searchBarRow}>
                  <div style={styles.searchBar}>
                    <span style={styles.searchIcon}>⌕</span>
                    <input
                      style={styles.searchInput}
                      placeholder="Search services"
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
                <select style={styles.input} value={category} onChange={(e) => setCategory(e.target.value as (typeof CATEGORY_OPTIONS)[number])}>
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
                  {busy ? 'Guardando...' : 'Agregar suscripción'}
                </button>
              </>
            )}
            {error ? <p style={styles.error}>{error}</p> : null}

            {selectedDayCharges.length > 0 ? (
              <div style={styles.dayList}>
                {selectedDayCharges.map((charge, idx) => (
                  <div key={`${charge.subscriptionId}-${idx}`} style={styles.row}>
                    <span>
                      {charge.name} · {formatArs(charge.amountArs)}
                      {charge.category ? ` · ${charge.category}` : ''}
                      {charge.cancelFrom ? ` · cortada desde ${charge.cancelFrom}` : ''}
                    </span>
                    <button
                      style={styles.dangerBtn}
                      onClick={() => deleteSubscription(charge.subscriptionId)}
                      disabled={busy || Boolean(charge.cancelFrom)}
                    >
                      {charge.cancelFrom ? 'Ya cortada' : 'Cortar desde este mes'}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p style={styles.muted}>Sin suscripciones este día.</p>
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
  mobileContainer: {
    width: '100%',
    maxWidth: 430,
    minHeight: '100vh',
    padding: '20px 16px 24px',
    display: 'grid',
    alignContent: 'start',
    gap: 14,
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
    justifyContent: 'flex-end',
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
    display: 'grid',
    gap: 10,
  },
  calendarWeekHeader: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
    gap: 6,
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
  },
  calendarCell: {
    minHeight: 58,
    border: '1px solid #2b2b2b',
    borderRadius: 14,
    padding: 6,
    background: '#202020',
    display: 'grid',
    alignContent: 'space-between',
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
  calendarDay: {
    fontSize: 12,
    textAlign: 'right',
  },
  badgeRow: {
    display: 'flex',
    gap: 4,
    justifyContent: 'flex-start',
  },
  calendarAvatar: {
    width: 18,
    height: 18,
    borderRadius: 999,
    background: '#2b5ca7',
    color: '#fff',
    fontSize: 10,
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
    display: 'grid',
    gap: 10,
    maxHeight: '88vh',
    overflowY: 'auto',
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
  searchBarRow: {
    marginTop: 8,
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
