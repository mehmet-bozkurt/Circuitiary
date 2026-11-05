## Ne değişti ve neden?

<!-- Tek konu, tek amaç. İlgili issue varsa: Closes #... -->

## Gözden geçirme listesi

- [ ] **Bilimsel dürüstlük:** her biyolojik ifade için kaynak bağlantısı var; model çıktısı ölçüm gibi sunulmuyor (docs/scientific-scope.md)
- [ ] **Ondalık virgül:** öğrenene gösterilen sayılar `src/format.ts` ile biçimleniyor
- [ ] **Erişilebilirlik:** WCAG AA kontrastı (açık ve koyu tema), rol/ad, klavye ile kullanım
- [ ] **Test:** yeni ya da değişen davranış için Vitest ve (arayüze dokunuyorsa) Playwright testi eklendi
- [ ] **Yerel kontroller geçti:** `npm run typecheck`, `npm test`, `npm run build`
- [ ] **Veri dosyası yok:** `data/` altından hiçbir şey eklenmedi; ham, türetilmiş ya da dönüştürülmüş veri tablosu içermiyor
- [ ] **Küçük ve odaklı:** gereksiz yeniden biçimlendirme, bağımlılık ya da ilgisiz değişiklik yok
- [ ] Gerekli belge güncellendi (README / docs)

## Nasıl denedim?

<!-- Çalıştırdığınız komutlar, tarayıcı, ekran görüntüsü (arayüz değiştiyse önce/sonra). Tarayıcı senaryolarını koşamadıysanız nedenini yazın. -->
