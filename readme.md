# 🎫 FluX Ticket Bot v2.0

Modern, özellik dolu ve profesyonel Discord ticket botu. Discord.js v14, Prisma ORM, REST API ve Web Dashboard ile.

![Discord.js](https://img.shields.io/badge/discord.js-v14-blue)
![Node.js](https://img.shields.io/badge/node.js-v18+-green)
![Prisma](https://img.shields.io/badge/prisma-v5-purple)
![License](https://img.shields.io/badge/license-MIT-yellow)

---

## ✨ Özellikler

### 🎫 Temel Ticket Sistemi
- ✅ Slash command desteği
- ✅ Buton ile ticket oluşturma
- ✅ Modal form desteği (konu + açıklama)
- ✅ Otomatik ticket numaralama (#0001, #0002...)
- ✅ Ticket claim/unclaim sistemi
- ✅ Kullanıcı ekleme/çıkarma

### 📁 Çoklu Kategori
- ✅ Sınırsız kategori oluşturma
- ✅ Kategori bazlı yetkili rolleri
- ✅ Özel emoji, renk, açıklama
- ✅ Select menu ile kategori seçimi

### 📄 Transcript & Rating
- ✅ HTML formatında transcript
- ✅ 1-5 yıldız değerlendirme sistemi
- ✅ Transcript URL'si database'de saklanır

### 🤖 Otomasyon
- ✅ Auto-close (inaktif ticketlar)
- ✅ Zamanlanmış kapatma (/scheduleclose)
- ✅ Hazır yanıt sistemi (canned responses)
- ✅ DM bildirimleri

### 📊 İstatistikler
- ✅ Sunucu istatistikleri (/stats)
- ✅ Yetkili performans (/mystats)
- ✅ Top 5 aktif yetkili
- ✅ Haftalık/günlük raporlar

### 🔒 Güvenlik
- ✅ Blacklist sistemi
- ✅ Ticket limiti (kullanıcı başına)
- ✅ Yetki kontrolü
- ✅ Cooldown sistemi

### 🌍 Çoklu Dil (i18n)
- ✅ Türkçe
- ✅ English

### 🌐 REST API
- ✅ API Key authentication
- ✅ CRUD endpoints
- ✅ Rate limiting
- ✅ Permission levels

### 🖥️ Web Dashboard
- ✅ React tabanlı SPA
- ✅ İstatistik görüntüleme
- ✅ Ticket listesi
- ✅ Kategori yönetimi

---

## 📦 Kurulum

### Gereksinimler
- Node.js v18+
- npm veya yarn
- Discord Bot Token

### 1. Repoyu klonla
```bash
git clone https://github.com/9a493/FluX-Ticket.git
cd FluX-Ticket
```

### 2. Bağımlılıkları yükle
```bash
npm install
```

### 3. Environment dosyası
```bash
cp .env.example .env
```

`.env` dosyasını düzenle:
```env
TOKEN=your_bot_token_here
CLIENT_ID=your_client_id_here
GUILD_ID=your_test_guild_id
DATABASE_URL="file:./dev.db"
NODE_ENV=development
PORT=3000
```

### 4. Database oluştur
```bash
npx prisma db push
npx prisma generate
```

### 5. Komutları kaydet
```bash
npm run deploy        # Test sunucusu
npm run deploy:global # Global (1 saat sürebilir)
```

### 6. Botu başlat
```bash
npm start     # Production
npm run dev   # Development (hot reload)
```

---

## 📋 Komutlar

### 🎫 Ticket Komutları
| Komut | Açıklama |
|-------|----------|
| `/close [sebep]` | Ticketı kapatır |
| `/claim` | Ticketı sahiplenir |
| `/unclaim` | Sahipliği bırakır |
| `/add @kullanıcı` | Kullanıcı ekler |
| `/remove @kullanıcı` | Kullanıcı çıkarır |
| `/rename <isim>` | Kanalı yeniden adlandırır |
| `/transfer @yetkili` | Ticketı devreder |
| `/move <kategori>` | Kategori değiştirir |
| `/priority <1-4>` | Öncelik belirler |
| `/tag add/remove/list` | Etiket yönetimi |
| `/info` | Ticket bilgileri |
| `/reopen` | Kapalı ticketı açar |
| `/archive` | Arşivler (salt okunur) |
| `/scheduleclose <süre>` | Zamanlanmış kapatma |
| `/cancelclose` | Zamanlamayı iptal eder |

### 👮 Yetkili Komutları
| Komut | Açıklama |
|-------|----------|
| `/canned add/remove/list/use` | Hazır yanıtlar |
| `/mystats [@kullanıcı]` | Kişisel istatistikler |
| `/tickets [durum]` | Ticket listesi |

### ⚙️ Yönetici Komutları
| Komut | Açıklama |
|-------|----------|
| `/setup` | Bot kurulumu |
| `/panel [kanal]` | Ticket paneli |
| `/category add/remove/list/edit` | Kategori yönetimi |
| `/blacklist @kullanıcı` | Kullanıcı engeller |
| `/unblacklist @kullanıcı` | Engel kaldırır |
| `/stats` | Sunucu istatistikleri |
| `/settings view/...` | Ayar yönetimi |
| `/language <dil>` | Dil değiştirir |
| `/apikey create/list/delete` | API anahtarı |

### 🔧 Genel
| Komut | Açıklama |
|-------|----------|
| `/ping` | Bot gecikmesi |
| `/help` | Yardım menüsü |

---

## 🌐 REST API

### Authentication
```
Authorization: Bearer ftk_xxxxxxxxxxxxx
```

### Endpoints

| Method | Endpoint | Açıklama |
|--------|----------|----------|
| GET | `/api/v1/guild` | Guild ayarları |
| PUT | `/api/v1/guild` | Ayarları güncelle |
| GET | `/api/v1/tickets` | Ticket listesi |
| GET | `/api/v1/stats` | İstatistikler |
| GET | `/api/v1/categories` | Kategoriler |
| POST | `/api/v1/categories` | Kategori oluştur |
| GET | `/api/v1/canned` | Hazır yanıtlar |

### Örnek Kullanım
```javascript
const response = await fetch('http://localhost:3000/api/v1/tickets', {
    headers: {
        'Authorization': 'Bearer ftk_xxxxxxxxxxxxx'
    }
});
const data = await response.json();
```

---

## 🖥️ Web Dashboard

Dashboard'u kullanmak için:

1. `dashboard/index.html` dosyasını tarayıcıda açın
2. API URL'sini girin (örn: `http://localhost:3000`)
3. API anahtarınızı girin
4. Bağlan!

API anahtarı almak için Discord'da `/apikey create` komutunu kullanın.

---

## 📁 Dosya Yapısı

```
flux-ticket/
├── dashboard/
│   └── index.html          # Web Dashboard (SPA)
├── prisma/
│   └── schema.prisma       # Database şeması
├── src/
│   ├── commands/
│   │   ├── admin/          # 9 komut
│   │   ├── ticket/         # 17 komut
│   │   └── utility/        # 3 komut
│   ├── events/
│   │   ├── interactionCreate.js
│   │   ├── messageCreate.js
│   │   └── ready.js
│   ├── locales/
│   │   ├── tr.json         # Türkçe
│   │   └── en.json         # English
│   ├── utils/
│   │   ├── autoClose.js
│   │   ├── database.js
│   │   ├── i18n.js
│   │   ├── logger.js
│   │   ├── notifications.js
│   │   ├── scheduler.js
│   │   ├── ticketManager.js
│   │   └── transcript.js
│   ├── deploy-commands.js
│   ├── index.js
│   └── server.js           # Express API
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

---

## 🚀 Deployment (Render)

1. Render.com'da yeni Web Service oluşturun
2. GitHub reposunu bağlayın
3. Environment variables:
   - `TOKEN`
   - `CLIENT_ID`
   - `DATABASE_URL` (PostgreSQL)
   - `NODE_ENV=production`
4. Build: `npm install && npx prisma generate && npx prisma db push`
5. Start: `npm start`

---

## 📝 Changelog

### v2.0.0 (Güncel)
- ✨ Modal form desteği
- ✨ Çoklu kategori
- ✨ Transcript sistemi (HTML)
- ✨ Rating sistemi (1-5 yıldız)
- ✨ Auto-close sistemi
- ✨ Zamanlanmış kapatma
- ✨ Hazır yanıtlar
- ✨ Öncelik seviyeleri
- ✨ Etiket sistemi
- ✨ Çoklu dil (TR/EN)
- ✨ REST API
- ✨ Web Dashboard
- ✨ DM bildirimleri
- ✨ Webhook desteği
- 🐛 Bug fixes

### v1.0.0
- 🎉 İlk sürüm

---

## 🤝 Katkıda Bulunma

1. Fork yapın
2. Feature branch: `git checkout -b feature/amazing`
3. Commit: `git commit -m 'Add amazing feature'`
4. Push: `git push origin feature/amazing`
5. Pull Request açın

---

## 📄 Lisans

MIT License - [LICENSE](LICENSE)

---

## 💬 Destek

- [GitHub Issues](https://github.com/9a493/FluX-Ticket/issues)

---

Made with ❤️ by FluX Team
