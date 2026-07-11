# 1453 Party House

Supabase destekli rezervasyon, müşteri ve fiyat takip uygulaması.

## Supabase kurulumu

1. Supabase Dashboard > SQL Editor bölümünde `supabase-schema.sql` dosyasını çalıştırın.
2. Authentication > Users bölümünde aşağıdaki kullanıcıları oluşturun ve **Auto Confirm User** seçeneğini açın:
   - `sule@1453partyhouse.com`
   - `mustafa@1453partyhouse.com`
   - `yahya@1453partyhouse.com`
   - `gamze@1453partyhouse.com`
3. Authentication ayarlarından yeni kullanıcı kaydını kapatın. Hesapları yalnızca yönetici oluştursun.

## GitHub Pages

1. Bu klasörün içindeki tüm dosyaları GitHub deposunun ana dizinine yükleyin.
2. GitHub'da Settings > Pages bölümünü açın.
3. Kaynak olarak `main` dalını ve `/ (root)` klasörünü seçin.
4. GitHub'ın oluşturduğu Pages bağlantısını açın.

`supabase-config.js` içindeki anon key istemci uygulamalarında kullanılmak üzere tasarlanmıştır. Database şifresini veya `service_role` key'i projeye eklemeyin.
