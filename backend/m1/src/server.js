const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = Number(process.env.PORT || 9090);
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, '..', 'data', 'dev-db.json');

const SUBJECT_TEMPLATES = {
  small: [
    { code: '1001', name: '库存现金', direction: 'DEBIT' },
    { code: '1002', name: '银行存款', direction: 'DEBIT' },
    { code: '1122', name: '应收账款', direction: 'DEBIT' },
    { code: '2202', name: '应付账款', direction: 'CREDIT' },
    { code: '5001', name: '主营业务收入', direction: 'CREDIT' },
    { code: '5602', name: '管理费用', direction: 'DEBIT' }
  ],
  enterprise: [
    { code: '1001', name: '库存现金', direction: 'DEBIT' },
    { code: '1002', name: '银行存款', direction: 'DEBIT' },
    { code: '1122', name: '应收账款', direction: 'DEBIT' },
    { code: '1405', name: '库存商品', direction: 'DEBIT' },
    { code: '2202', name: '应付账款', direction: 'CREDIT' },
    { code: '6001', name: '主营业务收入', direction: 'CREDIT' },
    { code: '6403', name: '税金及附加', direction: 'DEBIT' },
    { code: '6602', name: '管理费用', direction: 'DEBIT' }
  ]
};

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function defaultDB() {
  return {
    seq: { book: 1, period: 1, subject: 1, voucher: 1, entry: 1 },
    books: [],
    periods: [],
    subjects: [],
    vouchers: [],
    entries: [],
    auditLogs: []
  };
}

function readDB() {
  if (!fs.existsSync(DATA_FILE)) {
    return defaultDB();
  }
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function writeDB(db) {
  ensureDir(DATA_FILE);
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), 'utf8');
}

let db = readDB();

function json(res, code, payload) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function ok(res, data = {}, message = 'OK') {
  json(res, 200, { code: 0, message, data });
}

function fail(res, status, message) {
  json(res, status, { code: status, message, data: null });
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 2 * 1024 * 1024) {
        reject(new Error('Body too large'));
      }
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (e) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function toYearPeriod(dateStr) {
  const [y, m] = dateStr.split('-').map(Number);
  return { fiscalYear: y, periodNo: m };
}

function findBookByCode(code) {
  return db.books.find((b) => b.bookCode === code);
}

function requireBookByHeader(req, res) {
  const code = req.headers['x-book-code'];
  if (!code) {
    fail(res, 400, '缺少 X-Book-Code');
    return null;
  }
  const book = findBookByCode(code);
  if (!book) {
    fail(res, 404, '账套不存在');
    return null;
  }
  return book;
}

function requireOpenPeriod(bookId, fiscalYear, periodNo) {
  const p = db.periods.find((x) => x.bookId === bookId && x.fiscalYear === fiscalYear && x.periodNo === periodNo);
  if (!p) return { ok: false, msg: '期间不存在，请先初始化会计期间' };
  if (p.closeStatus !== 'OPEN') return { ok: false, msg: '当前期间已结账，禁止操作' };
  return { ok: true, period: p };
}

function nextNo(prefix, n) {
  return `${prefix}${String(n).padStart(4, '0')}`;
}

function addAudit(bizType, bizId, action, operator, beforeObj, afterObj, bookId) {
  db.auditLogs.push({
    id: db.auditLogs.length + 1,
    bookId,
    bizType,
    bizId: String(bizId),
    action,
    operator: operator || 'system',
    beforeJson: beforeObj || null,
    afterJson: afterObj || null,
    createdAt: new Date().toISOString()
  });
}

function computeTrialBalance(bookId, fiscalYear, periodNo) {
  const posted = db.vouchers.filter(
    (v) => v.bookId === bookId && v.status === 'POSTED' && v.fiscalYear === fiscalYear && v.periodNo === periodNo
  );
  const subjectMap = new Map(
    db.subjects.filter((s) => s.bookId === bookId).map((s) => [s.id, { subjectCode: s.subjectCode, subjectName: s.subjectName, direction: s.direction, occurDebit: 0, occurCredit: 0 }])
  );

  for (const v of posted) {
    const entries = db.entries.filter((e) => e.voucherId === v.id);
    for (const e of entries) {
      if (!subjectMap.has(e.subjectId)) continue;
      const row = subjectMap.get(e.subjectId);
      row.occurDebit += e.debitAmount;
      row.occurCredit += e.creditAmount;
    }
  }

  return [...subjectMap.values()].map((r) => {
    const balance = r.direction === 'DEBIT' ? r.occurDebit - r.occurCredit : r.occurCredit - r.occurDebit;
    return { ...r, balance };
  });
}

function routes(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const method = req.method;
  const pathname = url.pathname;

  if (method === 'GET' && pathname === '/health') {
    return ok(res, { status: 'up' });
  }

  // books
  if (method === 'POST' && pathname === '/api/v1/books') {
    return parseBody(req)
      .then((body) => {
        if (!body.bookCode || !body.bookName || !body.legalEntityName) {
          return fail(res, 400, 'bookCode/bookName/legalEntityName 必填');
        }
        if (db.books.some((b) => b.bookCode === body.bookCode)) {
          return fail(res, 409, 'bookCode 已存在');
        }
        const book = {
          id: db.seq.book++,
          bookCode: body.bookCode,
          bookName: body.bookName,
          legalEntityName: body.legalEntityName,
          status: 'ACTIVE',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        db.books.push(book);
        addAudit('BOOK', book.id, 'CREATE', body.operator || 'system', null, book, book.id);
        writeDB(db);
        return ok(res, book, '创建账套成功');
      })
      .catch((e) => fail(res, 400, e.message));
  }

  if (method === 'GET' && pathname === '/api/v1/books') {
    return ok(res, db.books);
  }

  if (method === 'POST' && /^\/api\/v1\/books\/\d+\/periods\/init$/.test(pathname)) {
    const bookId = Number(pathname.split('/')[4]);
    const book = db.books.find((b) => b.id === bookId);
    if (!book) return fail(res, 404, '账套不存在');
    return parseBody(req)
      .then((body) => {
        const fiscalYear = Number(body.fiscalYear || new Date().getFullYear());
        for (let p = 1; p <= 12; p++) {
          if (db.periods.some((x) => x.bookId === bookId && x.fiscalYear === fiscalYear && x.periodNo === p)) continue;
          db.periods.push({
            id: db.seq.period++,
            bookId,
            fiscalYear,
            periodNo: p,
            startDate: `${fiscalYear}-${String(p).padStart(2, '0')}-01`,
            endDate: `${fiscalYear}-${String(p).padStart(2, '0')}-31`,
            closeStatus: 'OPEN'
          });
        }
        writeDB(db);
        return ok(res, { bookId, fiscalYear }, '会计期间初始化成功');
      })
      .catch((e) => fail(res, 400, e.message));
  }

  if (method === 'POST' && /^\/api\/v1\/periods\/\d+\/(close|reopen)$/.test(pathname)) {
    const parts = pathname.split('/');
    const periodId = Number(parts[4]);
    const action = parts[5];
    const p = db.periods.find((x) => x.id === periodId);
    if (!p) return fail(res, 404, '期间不存在');
    p.closeStatus = action === 'close' ? 'CLOSED' : 'OPEN';
    writeDB(db);
    return ok(res, p, action === 'close' ? '期间已结账' : '期间已反结账');
  }

  // subjects
  if (method === 'POST' && pathname === '/api/v1/subjects/init') {
    const book = requireBookByHeader(req, res);
    if (!book) return;

    return parseBody(req)
      .then((body) => {
        const template = body.template || 'small';
        if (!SUBJECT_TEMPLATES[template]) return fail(res, 400, 'template 仅支持 small/enterprise');

        db.subjects = db.subjects.filter((s) => s.bookId !== book.id);
        for (const s of SUBJECT_TEMPLATES[template]) {
          db.subjects.push({
            id: db.seq.subject++,
            bookId: book.id,
            subjectCode: s.code,
            subjectName: s.name,
            direction: s.direction,
            isEnabled: true
          });
        }
        writeDB(db);
        return ok(res, db.subjects.filter((s) => s.bookId === book.id), '科目初始化成功');
      })
      .catch((e) => fail(res, 400, e.message));
  }

  if (method === 'GET' && pathname === '/api/v1/subjects') {
    const book = requireBookByHeader(req, res);
    if (!book) return;
    const list = db.subjects.filter((s) => s.bookId === book.id);
    return ok(res, list);
  }

  // vouchers
  if (method === 'POST' && pathname === '/api/v1/vouchers') {
    const book = requireBookByHeader(req, res);
    if (!book) return;

    return parseBody(req)
      .then((body) => {
        const voucherDate = body.voucherDate || today();
        const { fiscalYear, periodNo } = toYearPeriod(voucherDate);
        const periodCheck = requireOpenPeriod(book.id, fiscalYear, periodNo);
        if (!periodCheck.ok) return fail(res, 400, periodCheck.msg);

        const entries = body.entries || [];
        if (!entries.length) return fail(res, 400, 'entries 不能为空');

        let totalDebit = 0;
        let totalCredit = 0;
        for (const e of entries) {
          const subject = db.subjects.find((s) => s.bookId === book.id && s.subjectCode === e.subjectCode);
          if (!subject) return fail(res, 400, `科目不存在: ${e.subjectCode}`);
          const debit = Number(e.debitAmount || 0);
          const credit = Number(e.creditAmount || 0);
          if (!((debit > 0 && credit === 0) || (debit === 0 && credit > 0))) {
            return fail(res, 400, '分录必须单边金额');
          }
          totalDebit += debit;
          totalCredit += credit;
        }

        if (Math.abs(totalDebit - totalCredit) > 0.0001) {
          return fail(res, 400, '借贷不平衡');
        }

        const voucher = {
          id: db.seq.voucher++,
          bookId: book.id,
          voucherNo: nextNo('V', db.seq.voucher - 1),
          voucherDate,
          fiscalYear,
          periodNo,
          summary: body.summary || '未命名摘要',
          status: 'DRAFT',
          totalDebit,
          totalCredit,
          sourceType: body.sourceType || 'MANUAL',
          createdBy: body.operator || 'system',
          auditedBy: null,
          postedBy: null,
          createdAt: new Date().toISOString(),
          auditedAt: null,
          postedAt: null
        };
        db.vouchers.push(voucher);

        entries.forEach((e, idx) => {
          const subject = db.subjects.find((s) => s.bookId === book.id && s.subjectCode === e.subjectCode);
          db.entries.push({
            id: db.seq.entry++,
            voucherId: voucher.id,
            lineNo: idx + 1,
            subjectId: subject.id,
            assistType: e.assistType || null,
            assistCode: e.assistCode || null,
            assistName: e.assistName || null,
            entrySummary: e.entrySummary || voucher.summary,
            debitAmount: Number(e.debitAmount || 0),
            creditAmount: Number(e.creditAmount || 0)
          });
        });

        addAudit('VOUCHER', voucher.id, 'CREATE', body.operator || 'system', null, voucher, book.id);
        writeDB(db);
        return ok(res, voucher, '创建凭证成功');
      })
      .catch((e) => fail(res, 400, e.message));
  }

  if (method === 'GET' && pathname === '/api/v1/vouchers') {
    const book = requireBookByHeader(req, res);
    if (!book) return;
    const status = url.searchParams.get('status');
    let list = db.vouchers.filter((v) => v.bookId === book.id);
    if (status) list = list.filter((v) => v.status === status);
    return ok(res, list);
  }

  if (method === 'POST' && /^\/api\/v1\/vouchers\/\d+\/(audit|post)$/.test(pathname)) {
    const book = requireBookByHeader(req, res);
    if (!book) return;

    const parts = pathname.split('/');
    const voucherId = Number(parts[4]);
    const action = parts[5];
    const voucher = db.vouchers.find((v) => v.id === voucherId && v.bookId === book.id);
    if (!voucher) return fail(res, 404, '凭证不存在');

    const periodCheck = requireOpenPeriod(book.id, voucher.fiscalYear, voucher.periodNo);
    if (!periodCheck.ok) return fail(res, 400, periodCheck.msg);

    if (action === 'audit') {
      if (voucher.status !== 'DRAFT') return fail(res, 400, '仅草稿可审核');
      const before = { ...voucher };
      voucher.status = 'AUDITED';
      voucher.auditedAt = new Date().toISOString();
      voucher.auditedBy = 'system';
      addAudit('VOUCHER', voucher.id, 'AUDIT', 'system', before, voucher, book.id);
      writeDB(db);
      return ok(res, voucher, '审核成功');
    }

    if (action === 'post') {
      if (voucher.status !== 'AUDITED') return fail(res, 400, '仅已审核可记账');
      const before = { ...voucher };
      voucher.status = 'POSTED';
      voucher.postedAt = new Date().toISOString();
      voucher.postedBy = 'system';
      addAudit('VOUCHER', voucher.id, 'POST', 'system', before, voucher, book.id);
      writeDB(db);
      return ok(res, voucher, '记账成功');
    }
  }

  if (method === 'POST' && pathname === '/api/v1/vouchers/audit/batch') {
    const book = requireBookByHeader(req, res);
    if (!book) return;
    return parseBody(req)
      .then((body) => {
        const ids = body.voucherIds || [];
        let success = 0;
        let failed = 0;
        ids.forEach((id) => {
          const v = db.vouchers.find((x) => x.id === id && x.bookId === book.id);
          if (!v || v.status !== 'DRAFT') return failed++;
          const p = requireOpenPeriod(book.id, v.fiscalYear, v.periodNo);
          if (!p.ok) return failed++;
          v.status = 'AUDITED';
          v.auditedAt = new Date().toISOString();
          v.auditedBy = 'system';
          success++;
        });
        writeDB(db);
        return ok(res, { success, failed }, '批量审核完成');
      })
      .catch((e) => fail(res, 400, e.message));
  }

  if (method === 'POST' && pathname === '/api/v1/vouchers/post/batch') {
    const book = requireBookByHeader(req, res);
    if (!book) return;
    return parseBody(req)
      .then((body) => {
        const ids = body.voucherIds || [];
        let success = 0;
        let failed = 0;
        ids.forEach((id) => {
          const v = db.vouchers.find((x) => x.id === id && x.bookId === book.id);
          if (!v || v.status !== 'AUDITED') return failed++;
          const p = requireOpenPeriod(book.id, v.fiscalYear, v.periodNo);
          if (!p.ok) return failed++;
          v.status = 'POSTED';
          v.postedAt = new Date().toISOString();
          v.postedBy = 'system';
          success++;
        });
        writeDB(db);
        return ok(res, { success, failed }, '批量记账完成');
      })
      .catch((e) => fail(res, 400, e.message));
  }

  // trial balance
  if (method === 'GET' && pathname === '/api/v1/reports/trial-balance') {
    const book = requireBookByHeader(req, res);
    if (!book) return;
    const fy = Number(url.searchParams.get('fiscalYear'));
    const pn = Number(url.searchParams.get('periodNo'));
    if (!fy || !pn) return fail(res, 400, 'fiscalYear/periodNo 必填');
    return ok(res, computeTrialBalance(book.id, fy, pn));
  }

  return fail(res, 404, `Not Found: ${method} ${pathname}`);
}

const server = http.createServer((req, res) => {
  routes(req, res);
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`Phoenix M1 backend listening on :${PORT}`);
  });
}

module.exports = { server, readDB, writeDB, defaultDB };
