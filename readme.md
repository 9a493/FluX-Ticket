# 🎫 FluX Ticket Bot v2.1

Modern, güçlü ve profesyonel Discord ticket botu. Web Dashboard, Transcript sistemi ve çok daha fazlası.

## ✨ Özellikler

- 🎫 **Ticket Sistemi** - Kolay ve hızlı ticket oluşturma
- 📁 **Çoklu Kategori** - Destek, Satış, Şikayet vs.
- 📄 **Web Transcript** - Tüm ticketlar web'den görüntülenebilir
- 📊 **İstatistikler** - Detaylı ticket istatistikleri
- ⏰ **Otomatik Kapatma** - İnaktif ticketları otomatik kapat
- 🌐 **Çoklu Dil** - Türkçe ve İngilizce
- ⭐ **Değerlendirme** - Kullanıcı memnuniyet puanlaması
- 🚫 **Blacklist** - Kötüye kullananları engelle
- 📬 **DM Bildirimleri** - Ticket durumu değiştiğinde bildirim
- 🔑 **API Sistemi** - Dashboard için API anahtarları
- 🌍 **Global Bot** - Tüm sunucularda kullanılabilir

## 🚀 Kurulum

### 1. Repository'yi Klonla

```bash
git clone https://github.com/YOUR_USERNAME/flux-ticket-bot.git
cd flux-ticket-bot
```

### 2. Bağımlılıkları Yükle

```bash
npm install
```

### 3. Environment Variables

`.env.example` dosyasını `.env` olarak kopyalayın ve düzenleyin:

```bash
cp .env.example .env
```

```env
DISCORD_TOKEN=your_discord_bot_token
CLIENT_ID=your_application_client_id
DATABASE_URL=postgresql://user:password@host:5432/database
PORT=3000
BASE_URL=https://fluxdigital.com.tr
NODE_ENV=production
```

### 4. Database Setup

```bash
npx prisma generate
npx prisma db push
```

### 5. Komutları Deploy Et

```bash
# Global (tüm sunucular - 1 saat sürebilir)
npm run deploy:global

# Tek sunucu (test için - anında)
GUILD_ID=your_guild_id npm run deploy
```

### 6. Botu Başlat

```bash
npm start
```

## 🌐 Web Dashboard

Dashboard `https://YOUR_DOMAIN/` adresinde çalışır.

### Transcript Görüntüleme

Her ticket kapatıldığında otomatik olarak transcript oluşturulur ve `https://YOUR_DOMAIN/transcript/TRANSCRIPT_ID` adresinden görüntülenebilir.

### API Endpoints

| Endpoint | Method | Açıklama |
|----------|--------|----------|
| `/health` | GET | Health check |
| `/transcript/:id` | GET | Transcript görüntüle (public) |
| `/api/v1/guild` | GET | Guild bilgileri |
| `/api/v1/tickets` | GET | Ticket listesi |
| `/api/v1/categories` | GET | Kategoriler |
| `/api/v1/stats` | GET | İstatistikler |
| `/api/v1/transcripts` | GET | Transcript listesi |

API kullanımı için `Authorization: Bearer YOUR_API_KEY` header'ı gereklidir.

## 📋 Komutlar

### 🎫 Ticket Komutları

| Komut | Açıklama |
|-------|----------|
| `/close` | Ticketı kapat |
| `/claim` | Ticketı sahiplen |
| `/unclaim` | Sahipliği bırak |
| `/add` | Kullanıcı ekle |
| `/remove` | Kullanıcı çıkar |
| `/rename` | Kanal adını değiştir |
| `/transfer` | Başka yetkiliye devret |
| `/priority` | Öncelik belirle |
| `/tag` | Etiket ekle/kaldır |
| `/info` | Ticket bilgilerini göster |
| `/reopen` | Kapalı ticketı aç |
| `/archive` | Arşivle (salt okunur) |
| `/scheduleclose` | Zamanlanmış kapatma |
| `/cancelclose` | Zamanlamayı iptal |
| `/canned` | Hazır yanıtlar |

### 👑 Yönetici Komutları

| Komut | Açıklama |
|-------|----------|
| `/setup` | Bot kurulumu |
| `/panel` | Ticket paneli gönder |
| `/category` | Kategori yönetimi |
| `/stats` | İstatistikler |
| `/settings` | Bot ayarları |
| `/blacklist` | Kullanıcı engelle |
| `/unblacklist` | Engeli kaldır |
| `/apikey` | API anahtarı yönetimi |
| `/language` | Dil değiştir |

## 🔧 Render.com Deployment

1. GitHub'a push edin
2. Render.com'da "New Web Service" oluşturun
3. Repository'yi bağlayın
4. Environment variables ekleyin
5. Deploy!

veya `render.yaml` ile Blueprint kullanın.

## 📝 Lisans

MIT License - FluX Digital

## 🔗 Links

- **Website:** [fluxdigital.com.tr](https://fluxdigital.com.tr)
- **Discord:** [discord.gg/fluxdigital](https://discord.gg/fluxdigital)
- **GitHub:** [github.com/9a493/FluX-Ticket](https://github.com/9a493/FluX-Ticket)
