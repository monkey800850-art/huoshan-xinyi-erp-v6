import { rmSync } from 'node:fs';
import path from 'node:path';

const dataFile = path.resolve('data/smoke-db.json');
rmSync(dataFile, { force: true });
process.env.DATA_FILE = dataFile;
process.env.PORT = '9191';

const mod = await import('../src/server.js');
const server = mod.server;

await new Promise((resolve) => server.listen(9191, resolve));

async function req(method, url, body, headers = {}) {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined
  });
  const json = await res.json();
  if (!res.ok || json.code !== 0) {
    throw new Error(`${method} ${url} failed: ${JSON.stringify(json)}`);
  }
  return json.data;
}

try {
  const base = 'http://127.0.0.1:9191/api/v1';
  const book = await req('POST', `${base}/books`, {
    bookCode: 'BOOK001',
    bookName: '测试账套',
    legalEntityName: '测试法人'
  });

  await req('POST', `${base}/books/${book.id}/periods/init`, { fiscalYear: 2026 });
  await req('POST', `${base}/subjects/init`, { template: 'small' }, { 'X-Book-Code': 'BOOK001' });

  const voucher = await req('POST', `${base}/vouchers`, {
    voucherDate: '2026-03-18',
    summary: '支付办公费',
    entries: [
      { subjectCode: '5602', debitAmount: 2000, creditAmount: 0 },
      { subjectCode: '1002', debitAmount: 0, creditAmount: 2000 }
    ]
  }, { 'X-Book-Code': 'BOOK001' });

  await req('POST', `${base}/vouchers/${voucher.id}/audit`, {}, { 'X-Book-Code': 'BOOK001' });
  await req('POST', `${base}/vouchers/${voucher.id}/post`, {}, { 'X-Book-Code': 'BOOK001' });

  const tb = await req('GET', `${base}/reports/trial-balance?fiscalYear=2026&periodNo=3`, null, { 'X-Book-Code': 'BOOK001' });
  if (!Array.isArray(tb) || tb.length === 0) throw new Error('trial balance empty');

  const v2 = await req('POST', `${base}/vouchers`, {
    voucherDate: '2026-04-01',
    summary: '收到货款',
    entries: [
      { subjectCode: '1002', debitAmount: 1000, creditAmount: 0 },
      { subjectCode: '5001', debitAmount: 0, creditAmount: 1000 }
    ]
  }, { 'X-Book-Code': 'BOOK001' });

  await req('POST', `${base}/vouchers/audit/batch`, { voucherIds: [v2.id] }, { 'X-Book-Code': 'BOOK001' });
  await req('POST', `${base}/vouchers/post/batch`, { voucherIds: [v2.id] }, { 'X-Book-Code': 'BOOK001' });

  console.log('SMOKE OK');
} finally {
  await new Promise((resolve) => server.close(resolve));
}
