# Suscripciones (Web + Vercel)

App web con Next.js + Supabase para registrar suscripciones y ver cobros del anio (mensual/anual), con moneda fija `ARS`.

## 1) Configuracion local

1. Copia `.env.example` a `.env.local`.
2. Completa:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## 2) Base de datos Supabase

1. Abri SQL Editor en Supabase.
2. Ejecuta `supabase/schema.sql`.

Esto crea la tabla `subscriptions` y politicas RLS para que cada usuario solo vea sus datos.
Si ya tenias una base creada, ejecuta tambien `supabase/migrations/003_subscription_amount_overrides.sql` para habilitar historial de montos.

## 3) Ejecutar en local

```bash
npm install
npm run dev
```

Abrir `http://localhost:3000`.

## 4) Deploy en Vercel

1. Subi el repo a GitHub.
2. En Vercel: `Add New Project` -> importa el repo.
3. En `Environment Variables` carga:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy.

## Funcionalidad actual

- Login y registro con email/password.
- Alta de suscripcion con nombre, monto ARS, frecuencia y fecha de inicio.
- Resumen por mes (anio actual).
- Lista de proximos cobros.
- Historial de montos por suscripcion (ej: mayo 22000, junio en adelante 24000).
