import { fetchCollection } from '../src/lib/firebase';
import { isTabRestrictedForUser, normalizeYetki } from '../src/lib/yetkiUtils';

type Kullanici = {
  id?: string;
  email?: string;
  yetki?: string;
  kisitliSayfalar?: string[];
};

const probeTabs = ['ana_sayfa', 'personel', 'yoklama', 'maas', 'kibar_hakedis', 'kamp', 'formen_ekrani'];

async function main() {
  const list = await fetchCollection<Kullanici>('kullanicilar');
  const me = list.find((u) => String(u.email || '').toLowerCase() === 'sametatak9@gmail.com');
  if (!me) {
    console.log('user not found');
    return;
  }
  console.log('email:', me.email);
  console.log('yetki(raw):', me.yetki || '');
  console.log('yetki(normalized):', normalizeYetki(me.yetki));
  console.log('kisitliSayfalar count:', (me.kisitliSayfalar || []).length);
  console.log('kisitli sample:', (me.kisitliSayfalar || []).slice(0, 20));
  for (const tab of probeTabs) {
    const r = isTabRestrictedForUser(tab, me.yetki, me.kisitliSayfalar);
    console.log(`tab=${tab} restricted=${r}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

