import { auth } from './firebase';
import { isTaseronGrupTalep } from './taseronGrupSablon';
import { isSgkGrupTalep } from './sgkGrupSablon';

/** Onay sonrası gönderene WP metni. Başarısızlık kart yazımını geri almaz. */
export async function notifyWhatsAppPersonelKayit(
  item: {
    ad?: string;
    soyad?: string;
    personelIsim?: string;
    firmaAdi?: string;
    kaynak?: string;
    gonderenFormen?: string;
    gonderen?: string;
  },
  yon: 'giris' | 'cikis'
): Promise<void> {
  if (!item) return;
  const wpKaynak = isTaseronGrupTalep(item) || isSgkGrupTalep(item);
  const gonderen = String(item.gonderenFormen || item.gonderen || '');
  if (!wpKaynak && !/^wa:/i.test(gonderen)) return;
  try {
    const user = auth.currentUser;
    if (!user || user.isAnonymous) return;
    const token = await user.getIdToken();
    await fetch('/api/whatsapp-kayit-bildir', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ad: item.ad || '',
        soyad: item.soyad || '',
        personelIsim: item.personelIsim || '',
        firmaAdi: item.firmaAdi || '',
        yon,
        gonderen,
      }),
    });
  } catch (err) {
    console.warn('WhatsApp kayıt bildirimi atlandı:', err);
  }
}
