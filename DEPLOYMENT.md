# 🚀 Render Deployment Rehberi

Bu rehber Discord Ticket Bot'u Render'a nasıl deploy edeceğinizi gösterir.

## 📋 Ön Hazırlık

### 1. GitHub Repository Oluştur

```bash
# Git başlat
git init

# .gitignore kontrolü (node_modules, .env, logs dahil olmalı)
# İlk commit
git add .
git commit -m "Initial commit - Discord Ticket Bot"

# GitHub'a push
git remote add origin https://github.com/KULLANICIADIN/discord-ticket-bot.git
git branch -M main
git push -u origin main
```

### 2. Render Hesabı

1. https://render.com adresine git
2. GitHub ile giriş yap
3. Repository'ne erişim ver

## 🗄️ PostgreSQL Database Kurulumu

### Render Dashboard'da:

1. **New +** > **PostgreSQL** tıkla
2. Ayarları yap:
   - **Name**: `ticket-bot-db`
   - **Database**: `ticketbot`
   - **User**: `ticketbot`
   - **Region**: `Frankfurt` (Avrupa için)
   - **Plan**: `Free`
3. **Create Database** tıkla
4. Database oluşturulunca **Internal Database URL**'i kopyala

## 🤖 Bot Service Kurulumu

### Render Dashboard'da:

1. **New +** > **Web Service** tıkla
2. GitHub repository'ni seç: `discord-ticket-bot`
3. Ayarları yap:

```
Name: discord-ticket-bot
Region: Frankfurt
Branch: main
Runtime: Node
Build Command: npm install && npx prisma generate && npx prisma migrate deploy
Start Command: npm start
Plan: Free
```

### Environment Variables Ekle:

**Add Environment Variable** butonuna tıkla ve şunları ekle:

```env
NODE_ENV=production
TOKEN=your_discord_bot_token_here
CLIENT_ID=your_discord_application_id_here
DATABASE_URL=your_postgres_internal_url_here
PORT=3000
LOG_LEVEL=info
```

**ÖNEMLİ**: 
- `TOKEN` ve `CLIENT_ID` Discord Developer Portal'dan alınır
- `DATABASE_URL` yukarıda oluşturduğun PostgreSQL'in Internal URL'idir

4. **Create Web Service** tıkla

## 📊 Database Migration

İlk deploy'da otomatik olarak Prisma migration çalışacak. Ama manuel yapmak istersen:

### Lokal Migration (geliştirme):

```bash
# Prisma client oluştur
npx prisma generate

# Migration oluştur ve uygula
npx prisma migrate dev --name init

# Database'i görselleştir
npx prisma studio
```

### Production Migration:

Render otomatik olarak build sırasında çalıştırır:
```bash
npx prisma migrate deploy
```

## ✅ Deploy Sonrası Kontroller

### 1. Logs Kontrolü

Render Dashboard > Service > **Logs** sekmesi:

Şunları görmeli sin:
```
✅ Database bağlantısı başarılı
✅ Health check server started on port 3000
✅ Bot hazır! YourBot#1234 olarak giriş yapıldı
📊 X sunucuda aktif
```

### 2. Health Check

Render Service URL'ine git (örn: `https://discord-ticket-bot.onrender.com/health`)

Şunu görmelisin:
```json
{
  "status": "ok",
  "uptime": 123.45,
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 3. Discord Komutları

Discord'da komutları test et:
- `/ping` - Bot çalışıyor mu?
- `/setup` - Ticket sistemini kur
- Ticket oluştur ve kapat

## 🔧 Sorun Giderme

### Bot offline görünüyor

**Render Logs kontrolü:**
```bash
# Dashboard > Logs'a git
# Hata mesajlarını kontrol et
```

**Yaygın Hatalar:**

1. **Database connection failed**
   - `DATABASE_URL` doğru mu kontrol et
   - PostgreSQL servisi çalışıyor mu?

2. **Invalid token**
   - `TOKEN` environment variable doğru mu?
   - Discord Developer Portal'da token sıfırlandı mı?

3. **Module not found**
   - Build command çalıştı mı?
   - `npm install` tamamlandı mı?

### Free Tier Limitasyonları

Render Free Plan:
- ✅ 750 saat/ay (7/24 için yeterli)
- ✅ Otomatik sleep yok (web service için)
- ⚠️ 15 dakika inaktiviteden sonra spin down olabilir
- ⚠️ Cold start süresi (~30 saniye)

**Çözüm**: Cron job ile her 10 dakikada health check ping at:
```bash
# UptimeRobot veya cron-job.org kullan
# URL: https://your-bot.onrender.com/health
```

### Database Doldu (Free: 1GB)

```bash
# Eski ticketları temizle
npx prisma studio
# Veya SQL ile:
DELETE FROM "Ticket" WHERE "closedAt" < NOW() - INTERVAL '30 days';
```

## 🔄 Güncelleme (Update)

Yeni kod değişikliklerini deploy et:

```bash
# Lokal değişiklikleri commit et
git add .
git commit -m "Added new features"
git push origin main

# Render otomatik olarak yeni deploy başlatır
```

Manuel deploy:
```bash
# Render Dashboard > Service > Manual Deploy
```

## 🎛️ Environment Variables Yönetimi

### Değişkenleri Güncelleme:

1. Render Dashboard > Service > **Environment** sekmesi
2. Değişkeni düzenle
3. **Save Changes** (otomatik redeploy olur)

### Kritik Değişkenler:

```env
# Required (Zorunlu)
TOKEN=                    # Discord bot token
CLIENT_ID=                # Discord application ID
DATABASE_URL=             # PostgreSQL connection string

# Optional (Opsiyonel)
GUILD_ID=                 # Test sunucu ID (development)
NODE_ENV=production       # Environment
PORT=3000                 # Web server port
LOG_LEVEL=info            # Log seviyesi
```

## 📈 Monitoring

### Render Built-in:
- **Metrics**: CPU, Memory, Response Time
- **Logs**: Real-time log stream
- **Alerts**: Email alerts kurabilirsin

### External (Önerilen):
- **UptimeRobot**: Uptime monitoring (ücretsiz)
- **BetterStack**: Log management
- **Discord Webhook**: Hata bildirimleri

## 🔐 Güvenlik

### Secrets Yönetimi:
- ✅ Hiçbir secret GitHub'a push etme
- ✅ Render Environment Variables kullan
- ✅ `.env` dosyası `.gitignore`'da olmalı

### Database Security:
- ✅ Internal Database URL kullan (external değil)
- ✅ SSL/TLS aktif
- ✅ Render otomatik backup yapıyor (Free tier: 7 gün)

## 💰 Maliyet Tahmini

**Free Tier (Şu an):**
- Web Service: $0/ay (750 saat limit)
- PostgreSQL: $0/ay (1GB limit)
- **Toplam: $0/ay**

**Paid (Scale için):**
- Starter Web: $7/ay (512MB RAM)
- Starter PostgreSQL: $7/ay (1GB SSD)
- **Toplam: ~$14/ay**

**1000+ Sunucu için:**
- Pro Web: $25/ay (2GB RAM)
- Standard PostgreSQL: $20/ay (10GB SSD)
- **Toplam: ~$45/ay**

## 📚 Faydalı Linkler

- [Render Docs](https://render.com/docs)
- [Prisma Docs](https://www.prisma.io/docs)
- [Discord.js Guide](https://discordjs.guide)
- [PostgreSQL Docs](https://www.postgresql.org/docs/)

## 🆘 Yardım

Sorun yaşarsan:
1. Render Logs'u kontrol et
2. `logs/error.log` dosyasını incele
3. Discord Developer Portal'da bot ayarlarını kontrol et
4. GitHub Issues'da sor

---

**Başarılar! Bot artık 7/24 çalışıyor! 🎉**