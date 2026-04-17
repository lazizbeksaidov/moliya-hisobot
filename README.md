# Moliya — Shaxsiy Moliyaviy Hisobotchi

Shaxsiy kreditlar, daromadlar va xarajatlarni kuzatish uchun PWA ilovasi.

## Imkoniyatlar

- 🏦 Kreditlar (bank, foiz, oylik to'lov, qoldiq)
- 💰 Daromad va 💸 xarajatlar (10+ kategoriya)
- 🎯 Byudjet limitlari (oylik kategoriya bo'yicha)
- 🔄 Takrorlanuvchi tranzaktsiyalar (oylik maosh, ijara)
- 📊 Kunlik / haftalik / oylik tahlil
- 💡 Aqlli moliyaviy tavsiyalar
- ☁️ Supabase backend (yoki lokal localStorage)
- 📱 PWA (telefonga ilova kabi o'rnatiladi)

## Texnologiyalar

- Vanilla HTML/CSS/JS — build kerak emas
- Chart.js — grafiklar
- Supabase — auth + Postgres backend (ixtiyoriy)
- Vercel — hosting

## Sozlash

### 1. Lokal rejimda

Hech narsa kerak emas. `index.html` ni ochib ishlating.

### 2. Bulut rejimida (Supabase)

1. [supabase.com](https://supabase.com) → bepul loyiha yarating
2. SQL Editor → `supabase-schema.sql` ni paste qiling → Run
3. Settings → API'dan URL va anon key olib, ilova ichida **Sozlamalar → Supabase sozlash** orqali kiriting

## Deploy

```bash
vercel deploy --prod
```
