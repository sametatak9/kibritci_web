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
  { key: "saha_kolaj", label: "Saha Faaliyet Kolajı", group: "İDARİ İŞLER & SAHA" },
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

/** Mobil saha rolleri → erişilebilir panel sekmeleri */
export const MOBILE_ROLE_ALLOWED_TABS: Record<string, PortalPageKey[]> = {
  FORMEN: ['formen_ekrani', 'personel'],
  GÜVENLİK: ['guvenlik_ekrani'],
  KAMPÇI: ['kampci_ekrani'],
  LOJİSTİK: ['lojistik_ekrani'],
  DEPOCU: ['depocu_ekrani'],
};

/** @deprecated MOBILE_ROLE_ALLOWED_TABS kullanın */
export const MOBILE_ROLE_HOME_TAB: Record<string, PortalPageKey> = Object.fromEntries(
  Object.entries(MOBILE_ROLE_ALLOWED_TABS).map(([role, tabs]) => [role, tabs[0]])
) as Record<string, PortalPageKey>;

const YETKI_ALIASES: Record<string, string> = {
  KAMPCI: 'KAMPÇI',
  KAMPCİ: 'KAMPÇI',
  GUVENLIK: 'GÜVENLİK',
  LOJISTIK: 'LOJİSTİK',
  DEPO: 'DEPOCU',
  ŞOFÖR: 'LOJİSTİK',
  SOFOR: 'LOJİSTİK',
};

export function normalizeYetki(yetki?: string | null): string {
  if (!yetki) return "";
  let v = String(yetki).trim().toLocaleUpperCase("tr-TR");
  return YETKI_ALIASES[v] ?? v;
}

export function getRoleAllowedTabs(yetki?: string | null): PortalPageKey[] | null {
  const normalized = normalizeYetki(yetki);
  return MOBILE_ROLE_ALLOWED_TABS[normalized] ?? null;
}

export function getRoleHomeTab(yetki?: string | null): PortalPageKey | null {
  const allowed = getRoleAllowedTabs(yetki);
  return allowed?.[0] ?? null;
}

export function isMobileRole(yetki?: string | null): boolean {
  return getRoleAllowedTabs(yetki) !== null;
}

/** Tek panel — tam ekran mobil (Formen hariç; o personel sekmesine de erişir) */
export function isStandaloneMobileRole(yetki?: string | null): boolean {
  const allowed = getRoleAllowedTabs(yetki);
  return !!allowed && allowed.length === 1;
}

export function getMobileRoleDisplayName(yetki?: string | null): string {
  const n = normalizeYetki(yetki);
  const labels: Record<string, string> = {
    FORMEN: 'Formen Mobil + Personel',
    KAMPÇI: 'Kampçı Mobil',
    GÜVENLİK: 'Güvenlik Mobil',
    LOJİSTİK: 'Şöför Mobil',
    DEPOCU: 'Depocu Mobil',
  };
  return labels[n] || n;
}

/** Rol ana paneli kısıtlamalardan muaf; mobil roller yalnızca tanımlı panellere erişir */
export function isTabRestrictedForUser(
  tab: string,
  yetki?: string | null,
  kisitliSayfalar?: string[] | null
): boolean {
  const allowed = getRoleAllowedTabs(yetki);
  if (allowed) {
    return !allowed.includes(tab as PortalPageKey);
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

/** Mobil saha rolleri yalnızca tanımlı panel sekmelerini görür */
export function buildKisitliSayfalarForRole(yetki?: string | null): string[] | undefined {
  const allowed = getRoleAllowedTabs(yetki);
  if (allowed) {
    return PORTAL_PAGES.map((p) => p.key).filter((k) => !allowed.includes(k));
  }
  if (normalizeYetki(yetki) === 'MİSAFİR') {
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
  if (autoRestricted) {
    return { ...user, yetki, kisitliSayfalar: autoRestricted };
  }
  if (isMobileRole(user.yetki)) {
    return { ...user, yetki, kisitliSayfalar: [] };
  }
  return {
    ...user,
    yetki,
    kisitliSayfalar: sanitizeKisitliSayfalar(yetki, user.kisitliSayfalar ?? []),
  };
}
