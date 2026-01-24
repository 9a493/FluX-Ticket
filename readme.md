# 🎫 Discord Ticket Bot - Sprint 2 (Database + Render Deployment)

Profesyonel Discord ticket sistemi botu - PostgreSQL + Render ile 7/24 çalışır.

## 📋 Özellikler (Sprint 2)

### ✅ Temel Özellikler
- Slash Commands (Discord'un yeni komut sistemi)
- Ticket oluşturma/kapatma
- Otomatik izin yönetimi
- Embed mesajları ve butonlar
- Yetkili rol sistemi
- Detaylı loglama
- Cooldown sistemi
- Error handling

### ✅ Yeni Özellikler (Sprint 2)
- **PostgreSQL Database** - Tüm veriler kalıcı
- **Render Deployment** - 7/24 çalışır
- **Gelişmiş Ticket Sistemi**:
  - `/add` - Ticket'a kullanıcı ekle
  - `/remove` - Ticket'tan kullanıcı çıkar
  - `/claim` - Ticket'ı sahiplen
  - `/close` - Ticket'ı kapat (slash command)

## 🚀 Kurulum

### 1. Gereksinimler
- Node.js v18 veya üzeri
- Bir Discord Bot hesabı ([Discord Developer Portal](https://discord.com/developers/applications))

### 2. Klasör Yapısını Oluştur

```bash
mkdir -p discord-ticket-bot/{src/{commands/{ticket,utility,admin},events,utils,config,services,models},logs}
cd discord-ticket-bot
```

### 3. Paketleri Yükle

```bash
npm install
```

### 4. Environment Variables

`.env` dosyası oluştur ve şu bilgileri doldur:

```env
TOKEN=your_bot_token_here
CLIENT_ID=your_client_id_here
GUILD_ID=your_test_server_id_here  # Test için
NODE_ENV=development
```

### 5. Bot'u Discord Developer Portal'dan Ayarla

1. [Discord Developer Portal](https://discord.com/developers/applications)'a git
2. "New Application" tıkla
3. Bot sekmesine git ve "Add Bot" tıkla
4. Token'ı kopyala ve `.env` dosyasına yapıştır
5. **Privileged Gateway Intents** altında şunları aktif et:
   - ✅ SERVER MEMBERS INTENT
   - ✅ MESSAGE CONTENT INTENT

6. OAuth2 > URL Generator:
   - Scopes: `bot`, `applications.commands`
   - Bot Permissions:
     - ✅ Manage Channels
     - ✅ Manage Roles
     - ✅ Send Messages
     - ✅ Embed Links
     - ✅ Attach Files
     - ✅ Read Message History
     - ✅ Mention Everyone
     - ✅ Use Slash Commands

### 6. Komutları Discord'a Kaydet

```bash
npm run deploy
```

### 7. Botu Başlat

**Development mode (auto-restart):**
```bash
npm run dev
```

**Production mode:**
```bash
npm start
```

## 📁 Proje Yapısı

```
discord-ticket-bot/
├── src/
│   ├── commands/
│   │   ├── ticket/
│   │   │   └── setup.js          # Ticket sistemi kurulum komutu
│   │   └── utility/
│   │       └── ping.js           # Ping komutu
│   ├── events/
│   │   ├── ready.js              # Bot hazır olduğunda
│   │   ├── interactionCreate.js  # Komut/button handler
│   │   └── guildCreate.js        # Bot sunucuya eklendiğinde
│   ├── utils/
│   │   ├── logger.js             # Winston logger
│   │   └── ticketManager.js      # Ticket açma/kapama logic
│   ├── index.js                  # Ana bot dosyası
│   └── deploy-commands.js        # Komutları Discord'a kaydetme
├── logs/                         # Log dosyaları (otomatik oluşur)
├── .env                          # Environment variables
├── .gitignore
├── package.json
└── README.md
```

## 🎮 Kullanım

### Sunucuda Setup

1. Botu sunucuna davet et
2. `/setup` komutunu kullan:
   - **Kanal:** Ticket panelinin gönderileceği kanal
   - **Kategori:** Ticketların oluşturulacağı kategori
   - **Yetkili Rol:** Ticketları görecek rol
   - **Log Kanal:** (Opsiyonel) Logların gönderileceği kanal

### Ticket Oluşturma

1. Kullanıcılar panel mesajındaki "Ticket Oluştur" butonuna tıklar
2. Otomatik olarak özel bir kanal oluşturulur
3. Sadece kullanıcı ve yetkili rol kanalı görebilir

### Ticket Kapatma

1. Ticket kanalında "Ticketı Kapat" butonuna tıkla
2. Onaylama mesajında "Evet, Kapat" seç
3. Kanal 5 saniye sonra otomatik silinir

## 📊 Mevcut Komutlar

| Komut | Açıklama | İzin Gereksinimi |
|-------|----------|------------------|
| `/setup` | Ticket sistemini kurar | Administrator |
| `/ping` | Bot gecikme süresini gösterir | Herkes |

## 🔜 Gelecek Özellikler

Sprint 2'de eklenecekler:
- [ ] `/add` - Ticket'a kullanıcı ekle
- [ ] `/remove` - Ticket'tan kullanıcı çıkar
- [ ] `/claim` - Ticket'ı sahiplen
- [ ] Çoklu ticket kategorileri
- [ ] PostgreSQL database entegrasyonu
- [ ] Detaylı transcript sistemi
- [ ] Rate limiting (Redis)

## 🐛 Sorun Giderme

### "Application did not respond" hatası
- Botun yeterli izinlere sahip olduğundan emin ol
- Komutları tekrar deploy et: `npm run deploy`

### Bot offline görünüyor
- `.env` dosyasındaki TOKEN'ı kontrol et
- Bot'un Developer Portal'da aktif olduğundan emin ol

### Ticket kanalı oluşturulmuyor
- Botun "Manage Channels" iznine sahip olduğunu kontrol et
- Kategori limitine ulaşmadığınızı kontrol et (max 50 kanal)

## 📝 Loglar

Tüm aktiviteler `logs/` klasöründe saklanır:
- `combined.log` - Tüm loglar
- `error.log` - Sadece hatalar

## 🤝 Katkıda Bulunma

Bu proje aktif geliştirme aşamasında. Öneri ve geri bildirimlerinizi bekliyoruz!

## 📄 Lisans

MIT License

---

**Geliştirici Notları:**
- Bu MVP versiyonudur (Minimum Viable Product)
- Database henüz entegre edilmedi (geçici Map kullanıyor)
- Production'a almadan önce Redis + PostgreSQL eklenecek
- Sharding sistemi 2500+ sunucu için gerekli olacak