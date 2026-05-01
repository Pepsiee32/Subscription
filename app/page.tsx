'use client';

import { useEffect, useMemo, useState } from 'react';
import { Session, SupabaseClient } from '@supabase/supabase-js';
import { hasSupabaseEnv, supabase } from '../lib/supabase';
import { buildUpcomingCharges, filterFromToday, formatArs, formatDate, monthSummary } from '../lib/schedule';
import { Subscription } from '../types/subscription';

const year = new Date().getFullYear();

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

  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [frequency, setFrequency] = useState<'monthly' | 'yearly'>('monthly');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));

  async function loadData() {
    if (!supabase) return;
    const { data, error: fetchError } = await client
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('active', true)
      .order('start_date', { ascending: true });

    if (fetchError) setError(fetchError.message);
    else setItems((data as Subscription[]) ?? []);
  }

  useEffect(() => {
    loadData();
  }, []);

  async function createSubscription() {
    if (!supabase) return;
    const parsedAmount = Number(amount.replace(',', '.'));
    if (!name.trim() || Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Completá nombre y monto válido');
      return;
    }

    const { error: insertError } = await client.from('subscriptions').insert({
      user_id: userId,
      name: name.trim(),
      amount_ars: parsedAmount,
      frequency,
      start_date: startDate,
      active: true,
    });

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setName('');
    setAmount('');
    setFrequency('monthly');
    setStartDate(new Date().toISOString().slice(0, 10));
    setError('');
    await loadData();
  }

  const charges = useMemo(() => buildUpcomingCharges(items, year), [items]);
  const upcoming = useMemo(() => filterFromToday(charges), [charges]);
  const summary = useMemo(() => monthSummary(charges), [charges]);

  return (
    <section style={styles.stack}>
      <div style={styles.headerRow}>
        <div>
          <h1 style={styles.title}>Suscripciones {year}</h1>
          <p style={styles.muted}>Moneda fija: ARS</p>
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

      <div style={styles.card}>
        <h2 style={styles.subtitle}>Nueva suscripción</h2>
        <input style={styles.input} placeholder="Nombre" value={name} onChange={(e) => setName(e.target.value)} />
        <input style={styles.input} placeholder="Monto ARS" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <input style={styles.input} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        <select style={styles.input} value={frequency} onChange={(e) => setFrequency(e.target.value as 'monthly' | 'yearly')}>
          <option value="monthly">Mensual</option>
          <option value="yearly">Anual</option>
        </select>
        <button style={styles.primaryBtn} onClick={createSubscription}>
          Agregar suscripción
        </button>
        {error ? <p style={styles.error}>{error}</p> : null}
      </div>

      <div style={styles.card}>
        <h2 style={styles.subtitle}>Resumen por mes</h2>
        {summary.map((m) => (
          <div style={styles.row} key={m.label}>
            <span>{m.label}</span>
            <span>
              {m.count} cobros · {formatArs(m.total)}
            </span>
          </div>
        ))}
      </div>

      <div style={styles.card}>
        <h2 style={styles.subtitle}>Próximos cobros</h2>
        {upcoming.length === 0 ? (
          <p style={styles.muted}>No hay datos.</p>
        ) : (
          upcoming.map((charge) => (
            <div key={`${charge.subscriptionId}-${charge.date.toISOString()}`} style={styles.row}>
              <span>
                {charge.name} · {formatDate(charge.date)}
              </span>
              <strong>{formatArs(charge.amountArs)}</strong>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

const styles: Record<string, React.CSSProperties> = {
  main: {
    minHeight: '100vh',
    display: 'grid',
    placeItems: 'center',
    padding: 16,
  },
  stack: {
    width: '100%',
    maxWidth: 800,
    display: 'grid',
    gap: 16,
  },
  card: {
    background: '#191919',
    border: '1px solid #2a2a2a',
    borderRadius: 16,
    padding: 16,
    display: 'grid',
    gap: 10,
  },
  title: {
    margin: 0,
    fontSize: 28,
  },
  subtitle: {
    margin: 0,
    fontSize: 20,
  },
  muted: {
    margin: 0,
    color: '#b5b5b5',
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 10,
    border: '1px solid #3a3a3a',
    background: '#121212',
    color: '#f3f3f3',
  },
  primaryBtn: {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 10,
    border: 'none',
    background: '#ffffff',
    color: '#101010',
    fontWeight: 700,
    cursor: 'pointer',
  },
  secondaryBtn: {
    padding: '10px 12px',
    borderRadius: 10,
    border: '1px solid #4a4a4a',
    background: 'transparent',
    color: '#f3f3f3',
    fontWeight: 600,
    cursor: 'pointer',
  },
  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 10,
    padding: '8px 0',
    borderBottom: '1px solid #2a2a2a',
  },
  error: {
    margin: 0,
    color: '#ff9e9e',
  },
};
