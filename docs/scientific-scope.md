# Bilimsel kapsam ve modelin anlamı

Circuitiary, küçük sinir devreleri kurarak bağlantı, dinamik ve ölçüm arasındaki ilişkiyi öğrenmek için hazırlanmış bir eğitim projesidir. Sekiz hücreli öğretici devreye ek olarak, Cook2019 / Temmuz2020 verisinden AVER/AVAR çevresindeki 30 nöronluk yerel anatomik altgraf içe aktarılmıştır. Bu modda hücre kimlikleri, bağlantı türleri ve ham seri EM kesiti ağırlıkları kaynaktan gelir; işaret, dinamik güç ve zaman sabitleri ölçülmüş biyolojik değerler değildir.

## Birbirinden ayrı dört katman

1. **Anatomik graf:** Hangi hücrelerin hangi hücrelerle bağlantılı olduğunu ve kaynağın hangi yapısal ağırlığı kaydettiğini gösterir. Kimyasal sinapslar ile elektriksel bağlantılar ayrı bağlantı türleridir.
2. **Parametreli dinamik model:** Grafa bir etkinlik değişkeni, aktarım fonksiyonu, bağlantı etkileri ve zaman sabitleri ekler. Bunlar ayrıca ölçülmedikçe model varsayımlarıdır.
3. **Davranış simülasyonu:** Duyusal girdiler, kaslar veya eyleyiciler, beden mekaniği ve çevre gibi ek katmanlar gerektirir. Bir düğüm etkinliğinin grafikte yükselmesi tek başına davranış değildir.
4. **Biyolojik beyin emülasyonu:** Aynı hayvanın biyolojik yanıtlarını uygun deneylerde öngördüğünü göstermek gibi çok daha güçlü bir iddia gerektirir. Mevcut uygulama böyle bir emülasyon veya aktarılmış bir zihin değildir.

## Mevcut dinamik varsayımlar

Model, her düğüm için zaman içinde değişen **sürekli ve boyutsuz bir etkinlik** kullanır. Etkinlik değeri zar potansiyeli, ateşleme hızı veya kalsiyum floresansı olarak kalibre edilmemiştir. Çıktı grafikleri modelin kendi birimlerini gösterir.

Uygulanan denklem:

```text
tau_i * dx_i/dt = -x_i + clip(sum_j(w_ij * x_j) + I_i(t), 0, 1)
                 + sum_j(g_ij * (x_j - x_i))  # yalnız gerçek veri modu
```

Burada `j` kaynak, `i` hedef düğümdür; `w_ij` bağlantının varsayımsal dinamik ağırlığı, `I_i(t)` dış girdidir. `clip`, hedef etkinliği 0–1 aralığında sınırlar. Denklem, bütün düğümlerin önceki zaman adımını kullanan eşzamanlı açık Euler yöntemiyle yaklaşık çözülür. Varsayılan adım `dt = 1 ms`, zaman sabiti `tau = 30 ms`, başlangıç etkinliği sıfırdır. Zaman eksenindeki ms etiketi ve zaman sabitleri modelin seçilmiş zaman ölçeğidir; bu devre için ölçülmüş biyolojik zaman değerleri değildir.

İlk deney 700 ms sürer: S1 girdisi 100 ms anında başlar, 200 ms sürer ve genliği 0,8 olur. Üç koşul, aynı girdide temel devre; yalnızca `I3 → O1` kenarı kaldırılmış devre; yalnızca O1 zaman sabiti 90 ms yapılmış devredir. Son koşul düğümü susturma işlemi değildir; modelde O1 yanıt hızını değiştirir.

Bağlantı ağırlığı ve işareti, bir girdinin hedef etkinlik üzerindeki varsayılan etkisini belirler. Zaman sabiti, modelin girdiye ne hızla uyum sağladığını belirler. Uyarımın genliği ve süresi de model girdileridir. Bu değerlerin değiştirilmesiyle görülen fark, kullanılan varsayımlar altında yapılan bir deneydir; biyolojik etki büyüklüğü ölçümü değildir.

Sürekli etkinlik modeli bir öğretim tercihidir. Model, aksiyon potansiyelleri üretmez ve bütün *C. elegans* nöronlarının aynı biçimde spike ürettiği varsayımını taşımaz. İleride spike, iyon kanalı veya daha ayrıntılı hücre modelleri eklemek ayrı bir bilimsel ve sayısal kapsam olacaktır.

Bir anatomi verisi yüklendiğinde de dinamik parametreler otomatik olarak biyolojik doğruluk kazanmaz. Ham yapısal ağırlıktan etkin sinaptik kuvvete dönüşüm; eşik, doyum, gecikme, başlangıç durumu ve zaman ölçeği için açık kararlar gerekir. Gerçek veri deneyinde dış kimyasal girdi sıfırdır; dış bağlantılar çıkarılmıştır ve dış gap etkisi modellenmez. Dış hücreler sıfıra sabitlenmiş değildir; öyle bir model gap üzerinden sönüm oluştururdu. Yalıtılmış indüklenmiş altgraf seçimi açık bir sınır varsayımıdır.

## Kimyasal ve elektriksel bağlantılar

Kimyasal bağlantıda kaynaktan hedefe yön vardır. Sinapsın işaretini yalnızca nörotransmitter adından çıkarmak yeterli değildir: hedef hücrenin reseptörü ve bağlamı da gereklidir. Gerçek veri modunda ham anatomik ağırlık korunur. Kimyasal işaret kaynaktan bilinmiyor; mevcut deney tüm kimyasal etkileri açıkça pozitif varsayar. Model ağırlığı, ham ağırlığın hedefteki altgraf içi gelen ham toplamına oranı × seçilen katsayıdır; payda en az 1 olur. Reseptör kanıtı yoksa işaret “bilinmiyor” olarak kalmalıdır.

Gap junction bağlantısını kimyasal uyarıcı bağlantıya çevirmek yerine ayrı bir kanal olarak ele almak gerekir. Uygulanan simetrik difüzyon kuralı ayrıca bir model varsayımıdır; elektriksel bağlantıların bütün biyofiziğini doğrulamaz. İthalat beklenmedik asimetriyi reddeder ve bir fiziksel gap çiftini bir kez saklar. Kaynak diagonal kayıtları koordinatlarıyla ayrı raporlanır; kendi kendine elektriksel çift olarak yorumlanmaz. Gap katsayısı, ham ağırlık ve uçların altgraf içi gap toplamlarının büyüğüyle normalize edilir. Euler kararlılık sınırı dt <= tau/(1+toplam gap ağırlığı) olarak denetlenir.

## Neyin doğrulanmış sayılacağı

Tekrarlanabilir sonuç, aynı parametre ve uyaranların aynı model çıktısını üretmesidir. Model denkleminin doğru uygulanması, sayısal zaman adımının uygunluğu ve bağlantı yönünün doğru okunması da yazılım doğrulamasıdır. Bunlar hayvanın gerçek yanıtına ilişkin deneysel doğrulamanın yerine geçmez.

Randi ve arkadaşlarının işlevsel atlası doğrudan optogenetik uyarım ile kalsiyum görüntülemeyi kullanır. Ölçülen yayılım, dolaylı yolları ve anatominin tek başına açıklamadığı etkileri de içerebilir. AVER uyarımı ve AVAR yanıtı, gelecekteki deney seçimine dayanak olabilir; mevcut boyutsuz çıktının bu deneyi yeniden ürettiği anlamına gelmez. [Randi ve ark., Nature 2023](https://doi.org/10.1038/s41586-023-06683-4)

Kalsiyum verisiyle karşılaştırma için uyarım protokolü, ölçüm/gözlem modeli, zaman ve genlik kalibrasyonu, karşılaştırılabilir deney koşulları ve parametre ayarında kullanılmamış doğrulama verisi gerekir. Boyutsuz model çıktısını doğrudan ΔF/F olarak etiketlemek veya yalnızca benzer görünen iki eğriden biyolojik doğruluk çıkarmak uygun değildir.

## Kaynak ve lisans sınırı

Yerel anatomik ithalat [ayrı veri raporunda](real-data-next-step.md) tanımlanmıştır. Her veri sürümü, kaynak DOI, dosya özeti ve dönüşüm kararlarıyla izlenmelidir. Makalenin erişilebilir olması, ek dosyaların yeniden dağıtım lisansını kendiliğinden belirlemez. Cook SI5 dosyasının yeniden dağıtım izni bu aşamada doğrulanmamıştır; dosyanın veya türetilmiş veri altkümesinin proje deposuna eklenmesi, izin netleşene kadar kapsam dışıdır.
