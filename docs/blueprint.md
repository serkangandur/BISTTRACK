# **App Name**: BISTrack

## Core Features:

- Portfolio Data Management: Kullanıcıların BIST hisse senedi işlemlerini (alış/satış, miktar, maliyet) eklemesini, düzenlemesini ve silmesini sağlar, portföy verilerini sürekli güncel tutar.
- Live BIST Market Data Integration: Portföydeki Borsa İstanbul hisse senetleri için güncel piyasa fiyatlarını ve günlük yüzde değişimlerini anlık olarak getirir ve görüntüler.
- Dashboard Overview Cards: 'Toplam Varlık', 'Günlük Kâr/Zarar (%)' ve 'En Çok Yükselen Hissem' gibi anahtar metrikleri belirgin özet kartlarında gösterir.
- Interactive Stock Holdings Table: Hisse sembolü, adeti, maliyeti, güncel fiyatı, toplam değeri ve kâr/zarar durumunu gösteren, sıralanabilir ve filtrelenebilir detaylı bir tablo sunar.
- Visual Portfolio Analytics: Portföy dağılımını gösteren pastel tonlarda bir pasta grafik ve günlük değer değişimlerini izleyen basit bir çizgi grafik (Chart.js veya Recharts kullanarak) içerir.
- Dual-Tone Theming & Turkish Localization: Varsayılan karanlık mod (dark mode) tasarımıyla profesyonel bir görünüm sunar, artışları yeşil, azalışları kırmızı renkle belirtir ve tüm arayüzü ve terimleri Türkçe olarak sağlar.

## Style Guidelines:

- Birincil renk: Sert, canlı ama yormayan bir orta mavi (#66A5CC). Finansal bilgileri vurgulamak ve kullanıcının odağını çekmek için kullanılır.
- Arka plan rengi: Çok koyu, hafifçe mavimsi gri (#101418). Modern ve sofistike bir karanlık tema sağlayarak verilerin öne çıkmasını sağlar.
- Vurgu rengi: Parlak su mavisi (#87E4F2). Etkileşimli öğeler, kritik bildirimler ve ana hatlar için enerji dolu bir vurgu sunar.
- Fonksiyonel renkler: Yükselişler için canlı yeşil (#4CE54C) ve düşüşler için dinamik kırmızı (#E54C4C) kullanılarak veri yorumlamasını kolaylaştırır.
- Başlıklar ve gövde metni için 'Inter' (sans-serif) kullanılır. Modern, nesnel ve profesyonel bir veri panosu hissi verir.
- Finans ve borsa terminolojisine uygun, net ve modern çizgi simgeler tercih edilir. Genel kullanıcı arayüzü estetiğiyle tutarlılık önemlidir.
- Duyarlı (responsive) bir ızgara düzeni, özet kartları, tablo ve grafikler için ayrı bölümlerle bilgi hiyerarşisini netleştirir. Dark Mode tasarımı önceliklidir.
- Gezinme, veri yükleme ve grafik güncellemeleri için ince, pürüzsüz geçişler ve yükleme göstergeleri ile kullanıcı deneyimi zenginleştirilir.