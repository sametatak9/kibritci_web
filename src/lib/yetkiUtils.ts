/** Portal sayfa anahtarları — Sidebar ile YetkiVerme aynı listeyi kullanır */
export const PORTAL_PAGES = [
  { key: "ana_sayfa", label: "Ana Sayfa Dashboard", group: "BAŞLANGIÇ" },
  { key: "personel", label: "Personel Yönetimi", group: "PERSONEL" },
  { key: "personel_kartlari", label: "Personel Detay Kartları", group: "PERSONEL" },
  { key: "yoklama", label: "Yoklama ve Puantaj", group: "PERSONEL" },
  { key: "maas", label: "Maaş Hesaplama", group: "PERSONEL" },
  { key: "maas_odeme", label: "Maaş Ödeme", group: "PERSONEL" },
  { key: "personel_izin", label: "Personel İzin Formu", group: "PERSONEL" },
  { key: "kasa", label: "Haftalık Kasa", group: "FİNANS & ENVANTER" },
  { key: "satin_alma", label: "Satın Alma Talep", group: "FİNANS & ENVANTER" },
  { key: "irsaliye_giris", label: "İrsaliye ve Fiş Girişi", group: "FİNANS & ENVANTER" },
  { key: "fatura_giris", label: "Fatura Girişi", group: "FİNANS & ENVANTER" },
  { key: "taseron_kesinti", label: "Taşeron Kesintileri", group: "FİNANS & ENVANTER" },
  { key: "cari_stok", label: "Cari ve Stok Kartları", group: "FİNANS & ENVANTER" },
  { key: "evrak_aktarimi", label: "AI Belge Aktarımı", group: "FİNANS & ENVANTER" },
  { key: "kibar_hakedis", label: "ZER YAPI Hakediş", group: "FİNANS & ENVANTER" },
  { key: "planli_organizasyon", label: "Planlı Organizasyon", group: "FİNANS & ENVANTER" },
  { key: "operator", label: "Operatör Faaliyetleri", group: "İŞ MAKİNESİ & OPERATÖR" },
  { key: "arac", label: "Araç ve Demirbaş", group: "İDARİ İŞLER & SAHA" },
  { key: "kamp", label: "Kamp Yönetimi", group: "İDARİ İŞLER & SAHA" },
  { key: "saha", label: "Daily Saha Faaliyetleri", group: "İDARİ İŞLER & SAHA" },
  { key: "tutanak", label: "Hazır Tutanaklar", group: "İDARİ İŞLER & SAHA" },
  { key: "formen_ekrani", label: "Formen Mobil Paneli", group: "İDARİ İŞLER & SAHA" },
  { key: "guvenlik_ekrani", label: "Güvenlik & Kapı Kontrol", group: "İDARİ İŞLER & SAHA" },
  { key: "kampci_ekrani", label: "Kampçı Mobil Paneli", group: "İDARİ İŞLER & SAHA" },
  { key: "lojistik_ekrani", label: "Şöför Mobil Paneli", group: "İDARİ İŞLER & SAHA" },
  { key: "depocu_ekrani", label: "Depocu Mobil Paneli", group: "İDARİ İŞLER & SAHA" },
  { key: "sohbet", label: "Sohbet & Haberleşme", group: "RAPOR VE İLETİŞİM" },
  { key: "eposta", label: "E-Posta Merkezi", group: "RAPOR VE İLETİŞİM" },
  { key: "onay_islemleri", label: "Onay Havuzu & İmzalar", group: "RAPOR VE İLETİŞİM" },
  { key: "admin", label: "Üyelik & Admin Paneli", group: "ADMİNİSTRATOR" },
  { key: "yetki_verme", label: "Sayfa Yetkilendirme", group: "ADMİNİSTRATOR" },
] as const;

export type PortalPageKey = (typeof PORTAL_PAGES)[number]["key"];

/** Mobil saha rolleri → ana panel sekmesi */
export const MOBILE_ROLE_HOME_TAB: Record<string, PortalPageKey> = {
  FORMEN: "formen_ekrani",
  GÜVENLİK: "guvenlik_ekrani",
  KAMPÇI: "kampci_ekrani",
  LOJİSTİK: "lojistik_ekrani",
  DEPOCU: "depocu_ekrani",
};

const YETKI_ALIASES: Record<string, string> = {
  KAMPCI: "KAMPÇI",
  KAMPCİ: "KAMPÇI",
  GUVENLIK: "GÜVENLİK",
  LOJISTIK: "LOJİSTİK",
  DEPO: "DEPOCU",
};

export function normalizeYetki(yetki?: string | null): string {
  if (!yetki) return "";
  let v = String(yetki).trim().toLocaleUpperCase("tr-TR");
  return YETKI_ALIASES[v] ?? v;
}

export function getRoleHomeTab(yetki?: string | null): PortalPageKey | null {
  const normalized = normalizeYetki(yetki);
  return MOBILE_ROLE_HOME_TAB[normalized] ?? null;
}

export function isMobileRole(yetki?: string | null): boolean {
  return getRoleHomeTab(yetki) !== null;
}

/** Rol ana paneli kısıtlamalardan muaf; mobil roller sadece kendi paneline erişir */
export function isTabRestrictedForUser(
  tab: string,
  yetki?: string | null,
  kisitliSayfalar?: string[] | null
): boolean {
  const homeTab = getRoleHomeTab(yetki);
  if (homeTab) {
    return tab !== homeTab;
  }
  if (!kisitliSayfalar?.length) return false;
  return kisitliSayfalar.includes(tab);
}

/** Kayıt sırasında mobil rolün ana paneli asla kısıtlı listeye eklenmez */
export function sanitizeKisitliSayfalar(
  yetki: string | undefined,
  kisitliSayfalar: string[] | undefined
): string[] {
  const homeTab = getRoleHomeTab(yetki);
  if (!homeTab || !kisitliSayfalar?.length) return kisitliSayfalar ?? [];
  return kisitliSayfalar.filter((k) => k !== homeTab);
}

/** Mobil saha rolleri yalnızca kendi panel sekmesini görür */
export function buildKisitliSayfalarForRole(yetki?: string | null): string[] | undefined {
  const normalized = normalizeYetki(yetki);
  const homeTab = getRoleHomeTab(normalized);
  if (homeTab) {
    return PORTAL_PAGES.map((p) => p.key).filter((k) => k !== homeTab);
  }
  if (normalized === "MİSAFİR") {
    return PORTAL_PAGES.map((p) => p.key);
  }
  return undefined;
}

/** Admin paneli rol combobox listesi */
export const YETKI_ROLLER = [
  'YÖNETİCİ',
  'MUHASEBE',
  'İDARİ_İŞLER',
  'SATIN_ALMA',
  'ŞANTİYE_ŞEFİ',
  'PROJE_MÜDÜRÜ',
  'ELEKTRİK_ŞEFİ',
  'TESİSAT_ŞEFİ',
  'MEKANİK_ŞEFİ',
  'İNCE_İŞLER_ŞEFİ',
  'KABA_İŞLER_ŞEFİ',
  'DİZAYN_ŞEFİ',
  'PARSEL_ŞEFİ',
  'FORMEN',
  'KAMPÇI',
  'GÜVENLİK',
  'LOJİSTİK',
  'DEPOCU',
  'MİSAFİR',
] as const;

export type YetkiRol = (typeof YETKI_ROLLER)[number];

export interface YetkiSablonu {
  id: string;
  yetki: string;
  /** Menüde gizlenecek sayfa anahtarları */
  kisitliSayfalar: string[];
  /** Salt okunur sayfalar (görür ama düzenleyemez) — listede olmayan görünür sayfalar düzenlenebilir */
  saltOkunurSayfalar: string[];
  guncellemeTarihi: string;
}

/** Rol değişince yetki + sayfa kısıtlarını tek seferde uygular */
export function applyRoleDefaults<T extends { yetki?: string; kisitliSayfalar?: string[] }>(
  user: T,
  newYetki: string
): T & { yetki: string; kisitliSayfalar?: string[] } {
  const yetki = normalizeYetki(newYetki);
  const autoRestricted = buildKisitliSayfalarForRole(yetki);
  return {
    ...user,
    yetki,
    kisitliSayfalar: autoRestricted ?? sanitizeKisitliSayfalar(yetki, user.kisitliSayfalar),
  };
}
