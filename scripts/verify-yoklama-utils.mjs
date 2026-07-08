/** Shared helpers for legacy yoklama verification scripts */

export function countRecord(record) {
  const calisma = record.calismaGunleri?.length ?? 0;
  const izinli = record.izinliGunleri?.length ?? 0;
  const mesai = Object.values(record.mesaiGunleri ?? {}).reduce((s, h) => s + h, 0);
  return { calisma, izinli, paidDays: calisma + izinli, mesai };
}

export function verifyMonth(monthData, expectedRows, label) {
  const failures = [];
  const byId = new Map(monthData.personeller.map(p => [p.excelId, p]));
  const missing = [];

  for (const exp of expectedRows) {
    const rec = byId.get(exp.id);
    if (!rec) {
      missing.push(exp);
      continue;
    }
    const got = countRecord(rec);
    const name = `${rec.ad} ${rec.soyad}`;
    if (exp.gun != null && got.calisma !== exp.gun) {
      failures.push({ id: exp.id, name, field: 'gun', expected: exp.gun, got: got.calisma });
    }
    if (exp.mesai != null && Math.abs(got.mesai - exp.mesai) > 0.5) {
      failures.push({ id: exp.id, name, field: 'mesai', expected: exp.mesai, got: got.mesai });
    }
  }

  if (monthData.personeller.length !== expectedRows.length) {
    failures.push({
      id: 0,
      name: label,
      field: 'count',
      expected: expectedRows.length,
      got: monthData.personeller.length,
    });
  }

  return { failures, missing, total: monthData.personeller.length };
}

export function printReport(label, result) {
  console.log(`\n=== ${label} ===`);
  console.log(`Kayıt: ${result.total}`);
  if (result.missing.length) {
    console.log(`Eksik excelId: ${result.missing.map(m => m.id).join(', ')}`);
  }
  if (!result.failures.length) {
    console.log('OK — tüm gün/mesai eşleşti');
    return true;
  }
  result.failures.forEach(f => {
    console.log(`FAIL #${f.id} ${f.name}: ${f.field} beklenen=${f.expected} kod=${f.got}`);
  });
  return false;
}
