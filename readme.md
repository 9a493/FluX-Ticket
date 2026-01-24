# 🎫 FluX Ticket Bot v2.0

Modern ve özellik dolu Discord ticket botu. Discord.js v14, Prisma ORM ve birçok gelişmiş özellik ile.

![Discord.js](https://img.shields.io/badge/discord.js-v14-blue)
![Node.js](https://img.shields.io/badge/node.js-v18+-green)
![Prisma](https://img.shields.io/badge/prisma-v5-purple)
![License](https://img.shields.io/badge/license-MIT-yellow)

## ✨ Özellikler

### 🎫 Ticket Sistemi
- ✅ Slash command desteği
- ✅ Buton ile ticket oluşturma
- ✅ Çoklu kategori desteği
- ✅ Otomatik ticket numaralama (#0001, #0002...)
- ✅ Ticket claim/unclaim sistemi
- ✅ Öncelik seviyeleri (Düşük/Orta/Yüksek/Acil)
- ✅ Etiket sistemi
- ✅ Kullanıcı ekleme/çıkarma
- ✅ Ticket transfer etme
- ✅ Kategori değiştirme (move)
- ✅ Kanal yeniden adlandırma

### 📄 Transcript & Rating
- ✅ HTML formatında transcript oluşturma
- ✅ Kapanışta 1-5 yıldız değerlendirme
- ✅ Transcript URL'si database'de saklanır

### 🤖 Otomasyon
- ✅ Auto-close (48+ saat inaktif ticketlar)
- ✅ İnaktivite uyarısı (24 saat önceden)
- ✅ Hazır yanıt sistemi (canned responses)

### 📊 İstatistikler
- ✅ Sunucu istatistikleri (/stats)
- ✅ Yetkili performans istatistikleri (/mystats)
- ✅ Kategori bazlı istatistikler
- ✅ Top 5 aktif yetkili

### 🔒 Güvenlik
- ✅ Blacklist sistemi
- ✅ Kullanıcı başına ticket limiti
- ✅ Yetki kontrolü (staff roles)
- ✅ Cooldown sistemi

### 🛠️ Teknik
- ✅ Discord.js v14
- ✅ Prisma ORM (SQLite/PostgreSQL)
- ✅ Winston logging
- ✅ ES Modules
- ✅ Render deployment desteği
- ✅ Health check endpoint

---

## 📦 Kurulum

### Gereksinimler
- Node.js v18 veya üzeri
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

### 3. Environment dosyasını oluştur
```bash
cp .env.example .env
```

`.env` dosyasını düzenle:
```env
TOKEN=your_bot_token_here
CLIENT_ID=your_client_id_here
GUILD_ID=your_test_guild_id_here
DATABASE_URL="file:./dev.db"
NODE_ENV=development
```

### 4. Database'i oluştur
```bash
npx prisma db push
npx prisma generate
```

### 5. Komutları Discord'a kaydet
```bash
# Test sunucusuna (hızlı)
npm run deploy

# Global (1 saat sürebilir)
npm run deploy:global
```

### 6. Botu başlat
```bash
npm start

# veya development modunda
npm run dev
```

---

## 🚀 Kullanım

### İlk Kurulum
1. Botu sunucunuza davet edin (Administrator yetkisi ile)
2. `/setup` komutunu kullanın
3. Ticket paneli otomatik oluşturulacak

### Komutlar

#### 🎫 Ticket Komutları
| Komut | Açıklama |
|-------|----------|
| `/close [sebep]` | Ticketı kapatır |
| `/claim` | Ticketı sahiplenir |
| `/unclaim` | Ticket sahipliğini bırakır |
| `/add @kullanıcı` | Kullanıcı ekler |
| `/remove @kullanıcı` | Kullanıcı çıkarır |
| `/rename <isim>` | Kanalı yeniden adlandırır |
| `/transfer @yetkili` | Başka yetkiliye devreder |
| `/move <kategori>` | Kategori değiştirir |
| `/priority <seviye>` | Öncelik belirler |
| `/tag add/remove/list` | Etiket yönetimi |
| `/info` | Ticket bilgilerini gösterir |

#### 👮 Yetkili Komutları
| Komut | Açıklama |
|-------|----------|
| `/canned add/remove/list/use` | Hazır yanıt yönetimi |
| `/mystats` | Kişisel istatistikler |

#### ⚙️ Yönetici Komutları
| Komut | Açıklama |
|-------|----------|
| `/setup` | Bot kurulumu |
| `/panel [kanal]` | Ticket paneli gönderir |
| `/category add/remove/list` | Kategori yönetimi |
| `/blacklist @kullanıcı` | Kullanıcıyı engeller |
| `/unblacklist @kullanıcı` | Engeli kaldırır |
| `/stats` | Sunucu istatistikleri |

#### 🔧 Genel
| Komut | Açıklama |
|-------|----------|
| `/ping` | Bot gecikmesi |
| `/help` | Yardım menüsü |

---

## 🗄️ Database Şeması

```
Guild
├── id (Discord Guild ID)
├── categoryId (Discord Category)
├── logChannelId
├── staffRoles
├── ticketCount
├── categories[]
├── tickets[]
└── cannedResponses[]

Ticket
├── id
├── ticketNumber
├── channelId
├── userId
├── status (open/claimed/closed)
├── priority (1-4)
├── tags
├── claimedBy
├── rating (1-5)
└── transcriptUrl

Category
├── id
├── name
├── emoji
├── description
├── staffRoles
└── enabled

CannedResponse
├── id
├── name
├── content
├── useCount
└── createdBy
```

---

## 🌐 Render Deployment

1. Render.com'da yeni Web Service oluşturun
2. GitHub reposunu bağlayın
3. Environment variables ekleyin:
   - `TOKEN`
   - `CLIENT_ID`
   - `DATABASE_URL` (PostgreSQL)
   - `NODE_ENV=production`
4. Build command: `npm install && npx prisma generate && npx prisma db push`
5. Start command: `npm start`

---

## 📝 Changelog

### v2.0.0
- ✨ Çoklu kategori desteği
- ✨ Transcript sistemi (HTML)
- ✨ Rating sistemi (1-5 yıldız)
- ✨ Auto-close sistemi
- ✨ Hazır yanıt sistemi
- ✨ Öncelik seviyeleri
- ✨ Etiket sistemi
- ✨ Transfer komutu
- ✨ Move komutu
- ✨ Detaylı istatistikler
- 🐛 Bug fixes

### v1.0.0
- 🎉 İlk sürüm

---

## 🤝 Katkıda Bulunma

1. Fork yapın
2. Feature branch oluşturun (`git checkout -b feature/amazing-feature`)
3. Commit yapın (`git commit -m 'Add amazing feature'`)
4. Push yapın (`git push origin feature/amazing-feature`)
5. Pull Request açın

---

## 📄 Lisans

MIT License - Detaylar için [LICENSE](LICENSE) dosyasına bakın.

---

## 💬 Destek

- [GitHub Issues](https://github.com/9a493/FluX-Ticket/issues)
- Discord: [Sunucu Linki]

---

Made with ❤️ by FluX Team
