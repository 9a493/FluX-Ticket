# 🎫 FluX Ticket Bot v3.0 - MEGA Edition

**43+ Özellik içeren profesyonel Discord Ticket Bot**

## ✨ Özellikler

### 🎯 Tier S - Premium
- **Claude AI Entegrasyonu** - Otomatik yanıtlar, sentiment analizi, akıllı öneriler
- **Ticket Şablonları** - Bug report, feature request, şikayet formları
- **SLA Sistemi** - İlk yanıt/çözüm süreleri, eskalasyon, deadline takibi
- **Multi-Guild Dashboard** - Tüm sunucuları tek panelden yönet

### 🏆 Tier A - Gelişmiş
- **Grafik Dashboard** - Chart.js ile trend grafikleri
- **Staff Leaderboard** - XP, level, rozetler
- **Response Time Analytics** - Detaylı performans metrikleri
- **Auto-Assign** - Round-robin, load-based, rating-based
- **Keyword Triggers** - Otomatik kategori/öncelik/tag
- **Business Hours** - Çalışma saatleri dışı mesajları
- **Reminder System** - Ticket hatırlatıcıları
- **Spam Protection** - Flood ve spam koruması

### 🎮 Tier B - İletişim
- **Internal Notes** - Sadece yetkililerin görebildiği notlar
- **Ticket Merge** - İki ticketi birleştir
- **CC/Watchers** - Ticket takipçileri
- **Ticket Search** - Tam metin arama
- **Knowledge Base** - Makale yönetimi, oylama
- **Quick Actions** - Hızlı butonlar

### 🔒 Tier C - Güvenlik & Gamification
- **Audit Log** - Tüm işlemlerin kaydı
- **Backup System** - JSON export/import
- **XP System** - Aktiviteye göre XP
- **Badges** - 15+ farklı rozet
- **Streaks** - Günlük aktiflik serisi

## 📦 Kurulum

```bash
# Klonla
git clone https://github.com/your-repo/flux-ticket.git
cd flux-ticket

# Bağımlılıkları yükle
npm install

# Veritabanını oluştur
npx prisma db push

# .env dosyasını düzenle
cp .env.example .env

# Komutları deploy et
npm run deploy

# Başlat
npm start
```

## ⚙️ Yapılandırma

`.env` dosyası:
```env
DISCORD_TOKEN=your_bot_token
CLIENT_ID=your_client_id
DATABASE_URL="file:./dev.db"
ANTHROPIC_API_KEY=your_claude_api_key
API_PORT=3000
```

## 📋 Komutlar

### Ticket Komutları
| Komut | Açıklama |
|-------|----------|
| `/close` | Ticketi kapat |
| `/claim` | Ticketi sahiplen |
| `/unclaim` | Sahiplenmeyi bırak |
| `/add` | Kullanıcı ekle |
| `/remove` | Kullanıcı çıkar |
| `/priority` | Öncelik değiştir |
| `/rename` | Kanalı yeniden adlandır |
| `/note` | Dahili not ekle |
| `/search` | Ticket ara |
| `/merge` | Ticket birleştir |
| `/watch` | Takipçi ekle |
| `/remind` | Hatırlatıcı kur |

### Admin Komutları
| Komut | Açıklama |
|-------|----------|
| `/setup` | Bot kurulumu |
| `/panel` | Ticket paneli |
| `/category` | Kategori yönetimi |
| `/canned` | Hazır yanıtlar |
| `/template` | Şablonlar |
| `/trigger` | Keyword trigger |
| `/blacklist` | Kara liste |
| `/kb` | Bilgi bankası |
| `/sla` | SLA ayarları |
| `/ai` | AI ayarları |
| `/autoassign` | Oto-atama |
| `/businesshours` | Çalışma saatleri |
| `/backup` | Yedekleme |
| `/report` | Raporlar |
| `/auditlog` | Denetim günlüğü |

## 🌐 REST API

API endpoint'leri:
- `GET /api/stats` - İstatistikler
- `GET /api/tickets` - Ticket listesi
- `GET /api/staff` - Staff listesi
- `GET /api/kb` - Bilgi bankası
- Ve daha fazlası...

## 📊 Dashboard

`dashboard/index.html` dosyasını tarayıcıda açarak web arayüzüne erişebilirsiniz.

## 🤖 Claude AI

Bot, Anthropic Claude API kullanarak:
- Otomatik karşılama mesajları
- Sentiment analizi
- Kategori önerileri
- Hazır yanıt önerileri
- Ticket özetleri

oluşturabilir.

## 📄 Lisans

MIT License - FluX Digital

---

**FluX Ticket v3.0** - En gelişmiş Discord ticket botu! 🚀
