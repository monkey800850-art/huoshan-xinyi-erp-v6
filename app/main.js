const STORAGE_KEY = "phoenix_m1_m2_m3_m4_data";

const SUBJECT_TEMPLATES = {
  small: [
    { code: "1001", name: "库存现金", direction: "借" },
    { code: "1002", name: "银行存款", direction: "借" },
    { code: "1122", name: "应收账款", direction: "借" },
    { code: "2202", name: "应付账款", direction: "贷" },
    { code: "5001", name: "主营业务收入", direction: "贷" },
    { code: "5602", name: "管理费用", direction: "借" }
  ],
  enterprise: [
    { code: "1001", name: "库存现金", direction: "借" },
    { code: "1002", name: "银行存款", direction: "借" },
    { code: "1122", name: "应收账款", direction: "借" },
    { code: "1405", name: "库存商品", direction: "借" },
    { code: "2202", name: "应付账款", direction: "贷" },
    { code: "6001", name: "主营业务收入", direction: "贷" },
    { code: "6403", name: "税金及附加", direction: "借" },
    { code: "6602", name: "管理费用", direction: "借" }
  ]
};

const SUMMARY_LIBRARY = [
  "支付办公费",
  "支付房租",
  "支付工资",
  "收到货款",
  "采购商品入库",
  "支付供应商货款",
  "计提社保公积金",
  "计提折旧"
];

function toDateValue(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function money(v) {
  return Number(v || 0).toFixed(2);
}

function parseAmount(v) {
  const n = Number(String(v).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : 0;
}

function extractScenarioDate(text) {
  const m = text.match(/((?:19|20)\d{2})年\s*(1[0-2]|0?[1-9])月/);
  if (!m) return "";
  return `${m[1]}-${String(Number(m[2])).padStart(2, "0")}-01`;
}

function extractScenarioAmount(text) {
  const wanYuan = text.match(/(\d+(?:\.\d+)?)\s*万\s*元?/);
  if (wanYuan) return Number(wanYuan[1]) * 10000;
  const qianYuan = text.match(/(\d+(?:\.\d+)?)\s*千\s*元?/);
  if (qianYuan) return Number(qianYuan[1]) * 1000;
  const yuan = text.match(/(\d+(?:\.\d+)?)\s*元/);
  if (yuan) return Number(yuan[1]);

  const textWithoutDate = text
    .replace(/(?:19|20)\d{2}年\s*(?:1[0-2]|0?[1-9])月(?:\s*\d{1,2}日)?/g, "")
    .replace(/(?:19|20)\d{2}-\d{1,2}-\d{1,2}/g, "")
    .replace(/(?:19|20)\d{2}\/\d{1,2}\/\d{1,2}/g, "");

  const plain = textWithoutDate.match(/(\d+(?:\.\d+)?)/);
  return plain ? Number(plain[1]) : 1000;
}

function emptyBook(id = "B0001", name = "默认账套") {
  return {
    id,
    name,
    legalEntity: "默认法人",
    isLegalEntity: true,
    subjects: [],
    vouchers: [],
    assistItems: [],
    assistSeq: 1,
    seq: 1,
    reportSeq: 1,
    reportVersions: [],
    currentReportId: ""
  };
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const old = localStorage.getItem("phoenix_m1_m2_m3_data");
    if (old) {
      const s = JSON.parse(old);
      if (s.books) {
        return { ...s, mergeSeq: s.mergeSeq || 1, mergeVersions: s.mergeVersions || [], currentMergeId: s.currentMergeId || "" };
      }
    }
    const book = emptyBook();
    return {
      books: [book],
      bookSeq: 2,
      activeBookId: book.id,
      mergeSeq: 1,
      mergeVersions: [],
      currentMergeId: ""
    };
  }

  const s = JSON.parse(raw);
  if (s.books && Array.isArray(s.books)) {
    const books = s.books.map((b) => ({ ...b, assistItems: b.assistItems || [], assistSeq: b.assistSeq || 1 }));
    return {
      books,
      bookSeq: s.bookSeq || 1,
      activeBookId: s.activeBookId || (books[0] && books[0].id) || "",
      mergeSeq: s.mergeSeq || 1,
      mergeVersions: s.mergeVersions || [],
      currentMergeId: s.currentMergeId || ""
    };
  }

  const migrated = emptyBook("B0001", "迁移账套");
  migrated.subjects = s.subjects || [];
  migrated.vouchers = s.vouchers || [];
  migrated.assistItems = s.assistItems || [];
  migrated.assistSeq = s.assistSeq || 1;
  migrated.seq = s.seq || 1;
  migrated.reportSeq = s.reportSeq || 1;
  migrated.reportVersions = s.reportVersions || [];
  migrated.currentReportId = s.currentReportId || "";
  return {
    books: [migrated],
    bookSeq: 2,
    activeBookId: migrated.id,
    mergeSeq: 1,
    mergeVersions: [],
    currentMergeId: ""
  };
}

let state = loadState();
let selectedVoucherId = "";

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

const el = {
  activeBookSelect: document.querySelector("#activeBookSelect"),
  bookTableBody: document.querySelector("#bookTable tbody"),
  subjectsTableBody: document.querySelector("#subjectsTable tbody"),
  voucherTableBody: document.querySelector("#voucherTable tbody"),
  balanceTableBody: document.querySelector("#balanceTable tbody"),
  ledgerTableBody: document.querySelector("#ledgerTable tbody"),
  entryTableBody: document.querySelector("#entryTable tbody"),
  ledgerSubjectSelect: document.querySelector("#ledgerSubjectSelect"),
  reportTableBody: document.querySelector("#reportTable tbody"),
  reportVersionBody: document.querySelector("#reportVersionTable tbody"),
  reportMeta: document.querySelector("#reportMeta"),
  mergeChecks: document.querySelector("#mergeBookChecks"),
  mergeTableBody: document.querySelector("#mergeTable tbody"),
  mergeVersionBody: document.querySelector("#mergeVersionTable tbody"),
  mergeMeta: document.querySelector("#mergeMeta"),
  aiCheckBody: document.querySelector("#aiCheckTable tbody"),
  aiHint: document.querySelector("#aiHint"),
  assistTypeSelect: document.querySelector("#assistManageType"),
  assistTableBody: document.querySelector("#assistTable tbody"),
  orgCodeInput: document.querySelector("#orgCodeInput"),
  orgNameInput: document.querySelector("#orgNameInput"),
  addOrgBtn: document.querySelector("#addOrgBtn"),
  orgTableBody: document.querySelector("#orgTable tbody"),
  personCodeInput: document.querySelector("#personCodeInput"),
  personNameInput: document.querySelector("#personNameInput"),
  addPersonBtn: document.querySelector("#addPersonBtn"),
  personTableBody: document.querySelector("#personTable tbody"),
  deptCodeInput: document.querySelector("#deptCodeInput"),
  deptNameInput: document.querySelector("#deptNameInput"),
  addDeptBtn: document.querySelector("#addDeptBtn"),
  deptTableBody: document.querySelector("#deptTable tbody"),
  orgCreditCodeInput: document.querySelector("#orgCreditCodeInput"),
  orgAddressInput: document.querySelector("#orgAddressInput"),
  orgContactInput: document.querySelector("#orgContactInput"),
  orgPhoneInput: document.querySelector("#orgPhoneInput"),
  personKindSelect: document.querySelector("#personKindSelect"),
  personIdNoInput: document.querySelector("#personIdNoInput"),
  personAddressInput: document.querySelector("#personAddressInput"),
  personPhoneInput: document.querySelector("#personPhoneInput"),
  personDeptSelect: document.querySelector("#personDeptSelect"),
  transferPersonSelect: document.querySelector("#transferPersonSelect"),
  transferDeptSelect: document.querySelector("#transferDeptSelect"),
  transferDateInput: document.querySelector("#transferDateInput"),
  transferDeptBtn: document.querySelector("#transferDeptBtn"),
  deptManagerInput: document.querySelector("#deptManagerInput"),
  reportImportFile: document.querySelector("#reportImportFile"),
  importReportBtn: document.querySelector("#importReportBtn"),
  saveReportEditBtn: document.querySelector("#saveReportEditBtn"),
  downloadSubjectTemplateBtn: document.querySelector("#downloadSubjectTemplateBtn"),
  subjectImportFile: document.querySelector("#subjectImportFile"),
  importSubjectsBtn: document.querySelector("#importSubjectsBtn"),
  newSubjectCodeInput: document.querySelector("#newSubjectCodeInput"),
  newSubjectNameInput: document.querySelector("#newSubjectNameInput"),
  newSubjectDirectionSelect: document.querySelector("#newSubjectDirectionSelect"),
  addSubjectBtn: document.querySelector("#addSubjectBtn"),
  voucherDetailMeta: document.querySelector("#voucherDetailMeta"),
  voucherDetailTableBody: document.querySelector("#voucherDetailTable tbody")
};

function getActiveBook() {
  return state.books.find((b) => b.id === state.activeBookId) || state.books[0];
}

function reportTypeName(type) {
  return type === "bs" ? "资产负债表" : type === "pl" ? "利润表" : type === "cf" ? "现金流量表" : "所有者权益变动表";
}



function assistTypeName(type) {
  if (type === "ORG") return "单位";
  if (type === "PERSON") return "个人";
  if (type === "DEPT") return "部门";
  return "未分类";
}

function getAssistById(book, id) {
  return book.assistItems.find((x) => String(x.id) === String(id));
}

function isAssistItemUsed(book, assist) {
  return book.vouchers.some((v) => v.entries.some((e) => String(e.assistId || "") === String(assist.id)
    || (e.assistType === assist.type && (e.assistName === assist.name || e.assist === assist.name))));
}

function personDeptHistoryText(person) {
  const hist = person.meta?.deptHistory || [];
  if (!hist.length) return "-";
  return hist.map((h) => `${h.date}:${h.deptName}`).join(" | ");
}

function refreshArchiveSelectOptions(book) {
  const deptOptions = [`<option value="">请选择部门</option>`, ...book.assistItems.filter((x) => x.type === "DEPT").map((d) => `<option value="${d.id}">${d.code} ${d.name}</option>`)].join("");
  if (el.personDeptSelect) el.personDeptSelect.innerHTML = deptOptions;
  if (el.transferDeptSelect) el.transferDeptSelect.innerHTML = deptOptions;

  const personOptions = [`<option value="">请选择人员</option>`, ...book.assistItems.filter((x) => x.type === "PERSON").map((p) => `<option value="${p.id}">${p.code} ${p.name}</option>`)].join("");
  if (el.transferPersonSelect) el.transferPersonSelect.innerHTML = personOptions;
}

function renderArchiveTable(type, tbody) {
  const book = getActiveBook();
  if (!tbody) return;
  tbody.innerHTML = "";
  book.assistItems.filter((x) => x.type === type).forEach((a) => {
    const used = isAssistItemUsed(book, a);
    const action = used ? "已使用，不可删除" : `<button data-archive-action="delete" data-type="${type}" data-id="${a.id}">删除</button>`;
    const meta = a.meta || {};
    const tr = document.createElement("tr");

    if (type === "ORG") {
      tr.innerHTML = `<td>${a.id}</td><td>${a.code}</td><td>${a.name}</td><td>${meta.creditCode || ""}</td><td>${meta.address || ""}</td><td>${meta.contact || ""}</td><td>${meta.phone || ""}</td><td>${action}</td>`;
    } else if (type === "PERSON") {
      const kindName = meta.kind === "EMPLOYEE" ? "员工" : "外部";
      tr.innerHTML = `<td>${a.id}</td><td>${a.code}</td><td>${a.name}</td><td>${kindName}</td><td>${meta.idNo || ""}</td><td>${meta.address || ""}</td><td>${meta.phone || ""}</td><td>${personDeptHistoryText(a)}</td><td>${action}</td>`;
    } else {
      tr.innerHTML = `<td>${a.id}</td><td>${a.code}</td><td>${a.name}</td><td>${meta.manager || ""}</td><td>${action}</td>`;
    }
    tbody.appendChild(tr);
  });
}

function renderAssistProjects() {
  const book = getActiveBook();
  if (!el.assistTableBody) return;
  const type = el.assistTypeSelect ? el.assistTypeSelect.value : "";
  const rows = type ? book.assistItems.filter((x) => x.type === type) : book.assistItems;
  el.assistTableBody.innerHTML = "";
  rows.forEach((a) => {
    const used = isAssistItemUsed(book, a);
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${a.id}</td><td>${assistTypeName(a.type)}</td><td>${a.code}</td><td>${a.name}</td><td>${assistTypeName(a.type)}档案</td><td>${used ? "已使用" : "未使用"}</td>`;
    el.assistTableBody.appendChild(tr);
  });

  renderArchiveTable("ORG", el.orgTableBody);
  renderArchiveTable("PERSON", el.personTableBody);
  renderArchiveTable("DEPT", el.deptTableBody);
  refreshArchiveSelectOptions(book);
}

function addArchiveItem(type, code, name, meta = {}) {
  const book = getActiveBook();
  if (!code || !name) return "档案编码和名称不能为空";
  if (book.assistItems.some((x) => x.type === type && x.code === code)) return "同类别下编码已存在";
  book.assistItems.push({ id: book.assistSeq++, type, code, name, meta });
  saveState();
  renderAssistProjects();
  refreshAssistOptionsInEntryRows();
  return "";
}

function fillAssistOptionsForRow(tr, defaults = {}) {
  const book = getActiveBook();
  const typeSelect = tr.querySelector(".assist-type");
  const itemSelect = tr.querySelector(".assist-item");
  const textInput = tr.querySelector(".assist-text");

  function refreshItems() {
    const t = typeSelect.value;
    const list = t ? book.assistItems.filter((x) => x.type === t) : [];
    itemSelect.innerHTML = `<option value="">选择辅助项</option>` + list.map((x) => `<option value="${x.id}">${x.code} ${x.name}</option>`).join("");
    if (defaults.assistId) itemSelect.value = String(defaults.assistId);
  }

  typeSelect.value = defaults.assistType || "";
  textInput.value = defaults.assistName || "";
  refreshItems();

  typeSelect.onchange = () => {
    defaults.assistId = "";
    refreshItems();
  };

  itemSelect.onchange = () => {
    const picked = getAssistById(book, itemSelect.value);
    if (picked) textInput.value = picked.name;
  };
}

function refreshAssistOptionsInEntryRows() {
  if (!el.entryTableBody) return;
  el.entryTableBody.querySelectorAll("tr").forEach((tr) => {
    const typeSelect = tr.querySelector(".assist-type");
    const itemSelect = tr.querySelector(".assist-item");
    if (!typeSelect || !itemSelect) return;

    const selectedType = typeSelect.value || "";
    const selectedId = itemSelect.value || "";
    fillAssistOptionsForRow(tr, { assistType: selectedType, assistId: selectedId, assistName: tr.querySelector(".assist-text")?.value || "" });

    const currentValue = itemSelect.value;
    if (selectedId && String(currentValue) !== String(selectedId)) {
      itemSelect.value = "";
    }
  });
}

function getPostedVouchers(book, startDate = "", endDate = "") {
  return book.vouchers.filter((v) => {
    if (v.status !== "posted") return false;
    if (startDate && v.date < startDate) return false;
    if (endDate && v.date > endDate) return false;
    return true;
  });
}

function getSubjectMovement(book, posted) {
  const map = new Map();
  book.subjects.forEach((s) => map.set(s.code, { code: s.code, name: s.name, direction: s.direction, debit: 0, credit: 0 }));
  posted.forEach((v) => {
    v.entries.forEach((e) => {
      if (!map.has(e.subjectCode)) {
        map.set(e.subjectCode, { code: e.subjectCode, name: e.subjectName || "未知科目", direction: "借", debit: 0, credit: 0 });
      }
      const row = map.get(e.subjectCode);
      row.debit += e.debit;
      row.credit += e.credit;
    });
  });
  return [...map.values()];
}

function computeRowsFromMovements(reportType, posted, movements) {
  if (reportType === "bs") {
    let assets = 0;
    let liabilities = 0;
    let equity = 0;
    let income = 0;
    let expense = 0;

    movements.forEach((m) => {
      const debitNet = m.debit - m.credit;
      const creditNet = m.credit - m.debit;

      if (m.code.startsWith("1")) {
        if (debitNet >= 0) assets += debitNet;
        else liabilities += Math.abs(debitNet);
      } else if (m.code.startsWith("2")) {
        if (creditNet >= 0) liabilities += creditNet;
        else assets += Math.abs(creditNet);
      } else if (m.code.startsWith("3") || m.code.startsWith("4")) {
        equity += creditNet;
      }

      const isIncome = m.name.includes("收入") || ((m.code.startsWith("5") || m.code.startsWith("6")) && m.name.includes("收入"));
      const isExpense = m.name.includes("费用") || m.name.includes("成本") || m.name.includes("税金") || m.code.startsWith("64") || m.code.startsWith("66") || m.code.startsWith("56");
      if (isIncome) income += Math.max(creditNet, 0);
      if (isExpense) expense += Math.max(debitNet, 0);
    });

    const currentProfit = income - expense;
    equity += currentProfit;
    return [["资产合计", assets], ["负债合计", liabilities], ["所有者权益合计", equity], ["负债和权益合计", liabilities + equity]];
  }

  if (reportType === "pl") {
    let income = 0;
    let expense = 0;
    movements.forEach((m) => {
      const netCredit = m.credit - m.debit;
      const netDebit = m.debit - m.credit;
      const isIncome = m.name.includes("收入") || (m.code.startsWith("6") && m.name.includes("收入"));
      const isExpense = m.name.includes("费用") || m.name.includes("成本") || m.name.includes("税金") || m.code.startsWith("64") || m.code.startsWith("66") || m.code.startsWith("56");
      if (isIncome) income += Math.max(netCredit, 0);
      if (isExpense) expense += Math.max(netDebit, 0);
    });
    return [["营业收入", income], ["期间费用", expense], ["利润总额", income - expense]];
  }

  if (reportType === "oe") {
    let income = 0;
    let expense = 0;
    movements.forEach((m) => {
      const netCredit = m.credit - m.debit;
      const netDebit = m.debit - m.credit;
      const isIncome = m.name.includes("收入") || m.code.startsWith("5") || m.code.startsWith("6");
      const isExpense = m.name.includes("费用") || m.name.includes("成本") || m.name.includes("税金") || m.code.startsWith("64") || m.code.startsWith("66") || m.code.startsWith("56");
      if (isIncome) income += Math.max(netCredit, 0);
      if (isExpense) expense += Math.max(netDebit, 0);
    });
    const profit = income - expense;
    return [["期初所有者权益", 0], ["本期净利润", profit], ["其他综合变动", 0], ["期末所有者权益", profit]];
  }

  let inflow = 0;
  let outflow = 0;
  posted.forEach((v) => {
    v.entries.forEach((e) => {
      if (e.subjectCode === "1001" || e.subjectCode === "1002") {
        inflow += e.debit;
        outflow += e.credit;
      }
    });
  });
  return [["经营现金流入", inflow], ["经营现金流出", outflow], ["现金净增加额", inflow - outflow]];
}

function parseCsvLine(line = "") {
  const row = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (ch === "," && !quoted) {
      row.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  row.push(cur.trim());
  return row;
}

function importSubjectsFromCsv(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return [];
  const rows = lines.map(parseCsvLine);
  const body = rows.filter((r, idx) => {
    if (idx === 0) return !["编码", "code"].includes((r[0] || "").toLowerCase());
    return true;
  });

  const subjects = body.map((r) => ({ code: (r[0] || "").trim(), name: (r[1] || "").trim(), direction: (r[2] || "借").trim() || "借" }))
    .filter((x) => x.code && x.name)
    .map((x) => ({ ...x, direction: x.direction === "贷" ? "贷" : "借" }));

  const seen = new Set();
  const dedup = [];
  subjects.forEach((s) => {
    if (!seen.has(s.code)) {
      dedup.push(s);
      seen.add(s.code);
    }
  });
  return dedup;
}

function subjectTemplateCsv() {
  return [
    ["编码", "名称", "方向"],
    ["1001", "库存现金", "借"],
    ["1002", "银行存款", "借"],
    ["2202", "应付账款", "贷"],
    ["5602", "管理费用", "借"]
  ].map((l) => l.join(",")).join("\n");
}

function upsertSubjects(book, imported) {
  const map = new Map(book.subjects.map((s) => [s.code, { ...s }]));
  imported.forEach((s) => map.set(s.code, { ...s }));
  book.subjects = [...map.values()].sort((a, b) => a.code.localeCompare(b.code, "zh-Hans-CN"));
}

function renderVoucherDetail() {
  const book = getActiveBook();
  const body = el.voucherDetailTableBody;
  if (!body || !el.voucherDetailMeta) return;
  body.innerHTML = "";

  const target = book.vouchers.find((v) => v.id === selectedVoucherId) || book.vouchers[book.vouchers.length - 1];
  if (!target) {
    el.voucherDetailMeta.textContent = "点击凭证编号查看明细";
    return;
  }

  selectedVoucherId = target.id;
  el.voucherDetailMeta.textContent = `当前凭证：${target.id} | 日期 ${target.date} | 摘要 ${target.summary} | 状态 ${target.status}`;
  target.entries.forEach((e) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${e.subjectCode}</td><td>${e.subjectName || ""}</td><td>${money(e.debit)}</td><td>${money(e.credit)}</td><td>${e.assistName || e.assist || ""}</td>`;
    body.appendChild(tr);
  });
}

function renderBooks() {
  const active = getActiveBook();
  el.activeBookSelect.innerHTML = state.books.map((b) => `<option value="${b.id}" ${b.id === active.id ? "selected" : ""}>${b.id} ${b.name}</option>`).join("");
  el.bookTableBody.innerHTML = "";
  state.books.forEach((b) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${b.id}</td><td>${b.name}</td><td>${b.legalEntity || ""}</td><td>${b.isLegalEntity ? "法人账套" : "非法人账套"}</td><td>${b.id === active.id ? "当前" : ""}</td><td><button data-book-action="use" data-id="${b.id}">使用</button></td>`;
    el.bookTableBody.appendChild(tr);
  });
  el.mergeChecks.innerHTML = state.books.map((b) => `<label><input type="checkbox" data-merge-book="${b.id}" /> ${b.name}</label>`).join(" ");
}

function renderSubjects() {
  const book = getActiveBook();
  el.subjectsTableBody.innerHTML = "";
  book.subjects.forEach((s) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${s.code}</td><td>${s.name}</td><td>${s.direction}</td>`;
    el.subjectsTableBody.appendChild(tr);
  });
  el.ledgerSubjectSelect.innerHTML = book.subjects.map((s) => `<option value="${s.code}">${s.code} ${s.name}</option>`).join("");
}

function addEntryRow(defaults = {}) {
  const tpl = document.querySelector("#entryRowTemplate").content.cloneNode(true);
  const tr = tpl.querySelector("tr");
  const codeInput = tr.querySelector(".subject-code");
  const nameInput = tr.querySelector(".subject-name");
  const debitInput = tr.querySelector(".debit");
  const creditInput = tr.querySelector(".credit");
  const assistTypeSelect = tr.querySelector(".assist-type");
  const assistItemSelect = tr.querySelector(".assist-item");
  const assistTextInput = tr.querySelector(".assist-text");

  codeInput.value = defaults.subjectCode || "";
  debitInput.value = defaults.debit ? money(defaults.debit) : "";
  creditInput.value = defaults.credit ? money(defaults.credit) : "";
  fillAssistOptionsForRow(tr, {
    assistType: defaults.assistType || "",
    assistId: defaults.assistId || "",
    assistName: defaults.assist || defaults.assistName || ""
  });

  function fillName() {
    const s = getActiveBook().subjects.find((x) => x.code === codeInput.value.trim());
    nameInput.value = s ? s.name : "";
  }

  codeInput.addEventListener("input", fillName);
  fillName();

  tr.querySelector(".delete-row").addEventListener("click", () => {
    tr.remove();
    if (!el.entryTableBody.children.length) addEntryRow();
  });

  [codeInput, debitInput, creditInput, assistTypeSelect, assistItemSelect, assistTextInput].forEach((input) => {
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        addEntryRow();
        const last = el.entryTableBody.lastElementChild;
        if (last) last.querySelector(".subject-code").focus();
      }
    });
  });

  [debitInput, creditInput].forEach((input) => {
    input.addEventListener("keydown", (e) => {
      if (e.key === "=") {
        e.preventDefault();
        autoBalanceForLastRow(tr);
      }
    });
  });

  el.entryTableBody.appendChild(tr);
}

function isEntryRowEmpty(tr) {
  const code = tr.querySelector(".subject-code")?.value.trim() || "";
  const debit = parseAmount(tr.querySelector(".debit")?.value || "");
  const credit = parseAmount(tr.querySelector(".credit")?.value || "");
  const assistType = tr.querySelector(".assist-type")?.value || "";
  const assistId = tr.querySelector(".assist-item")?.value || "";
  const assistName = tr.querySelector(".assist-text")?.value.trim() || "";
  return !code && debit === 0 && credit === 0 && !assistType && !assistId && !assistName;
}

function pruneEmptyEntryRows() {
  [...el.entryTableBody.querySelectorAll("tr")].forEach((tr) => {
    if (isEntryRowEmpty(tr)) tr.remove();
  });
  if (!el.entryTableBody.children.length) addEntryRow();
}

function entryRowsToData() {
  const book = getActiveBook();
  return [...el.entryTableBody.querySelectorAll("tr")].map((tr) => {
    const code = tr.querySelector(".subject-code").value.trim();
    const s = book.subjects.find((x) => x.code === code);
    return {
      subjectCode: code,
      subjectName: s ? s.name : "",
      debit: parseAmount(tr.querySelector(".debit").value),
      credit: parseAmount(tr.querySelector(".credit").value),
      assistType: tr.querySelector(".assist-type").value || "",
      assistId: tr.querySelector(".assist-item").value || "",
      assistName: tr.querySelector(".assist-text").value.trim(),
      assist: tr.querySelector(".assist-text").value.trim()
    };
  }).filter((r) => r.subjectCode || r.debit || r.credit || r.assistName);
}

function autoBalanceForLastRow(currentRow) {
  const rows = [...el.entryTableBody.querySelectorAll("tr")];
  if (rows[rows.length - 1] !== currentRow) return;
  const diff = entryRowsToData().reduce((sum, e) => sum + e.debit - e.credit, 0);
  if (Math.abs(diff) < 0.0001) return;
  const debitInput = currentRow.querySelector(".debit");
  const creditInput = currentRow.querySelector(".credit");
  if (diff > 0) creditInput.value = money(parseAmount(creditInput.value) + diff);
  else debitInput.value = money(parseAmount(debitInput.value) + Math.abs(diff));
}

function resetEntryForm() {
  el.entryTableBody.innerHTML = "";
  addEntryRow();
}

function assertVoucherValid(voucher, book) {
  if (!voucher.date) return "请填写凭证日期";
  if (!voucher.summary) return "请填写摘要";
  if (!voucher.entries.length) return "请至少录入一条分录";
  for (const e of voucher.entries) {
    if (!e.subjectCode) return "分录科目编码不能为空";
    if (!book.subjects.some((s) => s.code === e.subjectCode)) return `科目不存在：${e.subjectCode}`;
    if ((e.debit > 0 && e.credit > 0) || (e.debit === 0 && e.credit === 0)) return "每行分录需且仅需填写借或贷金额";
  }
  if (Math.abs(voucher.totalDebit - voucher.totalCredit) > 0.0001) return "借贷不平衡，无法保存";
  return "";
}

function renderVouchers() {
  const book = getActiveBook();
  el.voucherTableBody.innerHTML = "";
  book.vouchers.forEach((v) => {
    const statusCls = v.status === "posted" ? "status-posted" : v.status === "audited" ? "status-audited" : "status-draft";
    const actions = [];
    if (v.status === "draft") actions.push(`<button data-action="audit" data-id="${v.id}">审核</button>`, `<button data-action="delete" data-id="${v.id}">删除</button>`);
    if (v.status === "audited") actions.push(`<button data-action="unaudit" data-id="${v.id}">反审核</button>`, `<button data-action="post" data-id="${v.id}">记账</button>`);
    if (v.status === "posted") actions.push(`<button data-action="unpost" data-id="${v.id}">反记账</button>`);

    const tr = document.createElement("tr");
    tr.innerHTML = `<td><button class="link-btn" data-action="view" data-id="${v.id}">${v.id}</button></td><td>${v.date}</td><td>${v.summary}</td><td>${money(v.totalDebit)}</td><td>${money(v.totalCredit)}</td><td class="${statusCls}">${v.status}</td><td>${actions.join("")}</td>`;
    el.voucherTableBody.appendChild(tr);
  });
}

function renderBalanceTable() {
  const book = getActiveBook();
  const movements = getSubjectMovement(book, getPostedVouchers(book));
  el.balanceTableBody.innerHTML = "";
  movements.forEach((m) => {
    const bal = m.direction === "借" ? m.debit - m.credit : m.credit - m.debit;
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${m.code}</td><td>${m.name}</td><td>${money(m.debit)}</td><td>${money(m.credit)}</td><td>${money(bal)}</td><td><button data-ledger-subject="${m.code}">查看明细</button></td>`;
    el.balanceTableBody.appendChild(tr);
  });
}

function renderLedger() {
  const book = getActiveBook();
  const code = el.ledgerSubjectSelect.value;
  el.ledgerTableBody.innerHTML = "";
  getPostedVouchers(book).forEach((v) => {
    v.entries.filter((e) => e.subjectCode === code).forEach((e) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${v.date}</td><td>${v.id}</td><td>${v.summary}</td><td>${money(e.debit)}</td><td>${money(e.credit)}</td><td>${e.assistName || e.assist || ""}</td>`;
      el.ledgerTableBody.appendChild(tr);
    });
  });
}

function buildReportRows(book, reportType, startDate, endDate) {
  const posted = getPostedVouchers(book, startDate, endDate);
  const movements = getSubjectMovement(book, posted);
  return computeRowsFromMovements(reportType, posted, movements);
}

function renderCurrentReport() {
  const book = getActiveBook();
  el.reportTableBody.innerHTML = "";
  const cur = book.reportVersions.find((r) => r.id === book.currentReportId);
  if (!cur) {
    el.reportMeta.textContent = "未生成报表";
    return;
  }
  el.reportMeta.textContent = `当前报表：${cur.id} | ${reportTypeName(cur.type)} | ${cur.startDate} ~ ${cur.endDate} | ${cur.generatedAt}`;
  cur.rows.forEach(([n, v], idx) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td><input data-report-edit="name" data-idx="${idx}" value="${n}" /></td><td><input data-report-edit="value" data-idx="${idx}" value="${money(v)}" /></td>`;
    el.reportTableBody.appendChild(tr);
  });
}

function renderReportVersions() {
  const book = getActiveBook();
  el.reportVersionBody.innerHTML = "";
  [...book.reportVersions].reverse().forEach((r) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${r.id}</td><td>${reportTypeName(r.type)}</td><td>${r.startDate} ~ ${r.endDate}</td><td>${r.generatedAt}</td><td><button data-report-action="view" data-id="${r.id}">查看</button><button data-report-action="export" data-id="${r.id}">导出CSV</button></td>`;
    el.reportVersionBody.appendChild(tr);
  });
}

function renderCurrentMerge() {
  el.mergeTableBody.innerHTML = "";
  const cur = state.mergeVersions.find((m) => m.id === state.currentMergeId);
  if (!cur) {
    el.mergeMeta.textContent = "未生成合并报表";
    return;
  }
  el.mergeMeta.textContent = `当前合并：${cur.id} | ${reportTypeName(cur.type)} | 账套 ${cur.bookNames.join("、")} | ${cur.startDate} ~ ${cur.endDate}`;
  cur.rows.forEach(([n, v]) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${n}</td><td>${money(v)}</td>`;
    el.mergeTableBody.appendChild(tr);
  });
}

function renderMergeVersions() {
  el.mergeVersionBody.innerHTML = "";
  [...state.mergeVersions].reverse().forEach((r) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${r.id}</td><td>${reportTypeName(r.type)}</td><td>${r.bookNames.join("、")}</td><td>${r.startDate} ~ ${r.endDate}</td><td>${r.generatedAt}</td><td><button data-merge-action="view" data-id="${r.id}">查看</button><button data-merge-action="export" data-id="${r.id}">导出CSV</button></td>`;
    el.mergeVersionBody.appendChild(tr);
  });
}

function resequenceVouchers(book) {
  book.vouchers
    .sort((a, b) => String(a.id).localeCompare(String(b.id), "zh-Hans-CN"))
    .forEach((v, idx) => {
      v.id = `V${String(idx + 1).padStart(4, "0")}`;
    });
}

function parseReportRowsFromCsv(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const rows = [];
  lines.forEach((line, idx) => {
    const cols = parseCsvLine(line);
    if (!cols.length) return;
    if (idx === 0 && (cols[0] === "项目" || cols[0] === "名称")) return;
    const name = (cols[0] || "").trim();
    const value = parseAmount(cols[1] || "0");
    if (name) rows.push([name, value]);
  });
  return rows;
}

function reportToCsv(report, title = "报表") {
  const lines = [["标题", title], ["版本", report.id], ["类型", reportTypeName(report.type)], ["期间", `${report.startDate}~${report.endDate}`], ["生成时间", report.generatedAt], [], ["项目", "金额"], ...report.rows.map(([n, v]) => [n, money(v)])];
  return lines.map((l) => l.join(",")).join("\n");
}

function downloadCsv(filename, text) {
  const blob = new Blob([`\ufeff${text}`], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function aiSuggestSummary(inputText = "") {
  const source = inputText || document.querySelector("#voucherSummary").value || "";
  const match = SUMMARY_LIBRARY.find((item) => source.includes(item.replace("支付", "")) || source.includes(item));
  return match || SUMMARY_LIBRARY[Math.floor(Math.random() * SUMMARY_LIBRARY.length)];
}

function findSubjectCodeByKeywords(book, keywords) {
  const target = book.subjects.find((s) => keywords.some((k) => s.name.includes(k)));
  return target ? target.code : "";
}

function aiGenerateVoucherDraft(scenario) {
  const book = getActiveBook();
  if (!book.subjects.length) {
    alert("请先初始化当前账套科目");
    return;
  }
  const text = scenario.trim();
  const amount = extractScenarioAmount(text);
  const pickedDate = extractScenarioDate(text);

  let debitCode = "";
  let creditCode = "";
  let summary = aiSuggestSummary(text);

  if (text.includes("办公") || text.includes("管理费")) {
    debitCode = findSubjectCodeByKeywords(book, ["管理费用", "税金及附加"]);
    creditCode = findSubjectCodeByKeywords(book, ["银行存款", "库存现金"]);
    summary = "支付办公费";
  } else if (text.includes("收到") || text.includes("收款") || text.includes("货款")) {
    debitCode = findSubjectCodeByKeywords(book, ["银行存款", "库存现金", "应收账款"]);
    creditCode = findSubjectCodeByKeywords(book, ["主营业务收入"]);
    summary = "收到货款";
  } else if (text.includes("工资")) {
    debitCode = findSubjectCodeByKeywords(book, ["管理费用"]);
    creditCode = findSubjectCodeByKeywords(book, ["银行存款", "库存现金"]);
    summary = "支付工资";
  }

  if (!debitCode) debitCode = book.subjects[0]?.code || "";
  if (!creditCode) creditCode = book.subjects[1]?.code || book.subjects[0]?.code || "";

  document.querySelector("#voucherSummary").value = summary;
  if (pickedDate) document.querySelector("#voucherDate").value = pickedDate;
  resetEntryForm();
  el.entryTableBody.innerHTML = "";
  addEntryRow({ subjectCode: debitCode, debit: amount, credit: 0, assistType: "PERSON", assistName: "AI草稿" });
  addEntryRow({ subjectCode: creditCode, debit: 0, credit: amount, assistType: "PERSON", assistName: "AI草稿" });

  el.aiHint.textContent = `AI已生成草稿：${summary}，金额 ${money(amount)}`;
}

function aiSmartCheck() {
  const rows = entryRowsToData();
  const checks = [];
  const totalDebit = rows.reduce((sum, r) => sum + r.debit, 0);
  const totalCredit = rows.reduce((sum, r) => sum + r.credit, 0);

  checks.push({
    item: "借贷平衡",
    ok: Math.abs(totalDebit - totalCredit) < 0.0001,
    suggestion: "使用最后一行金额输入 = 自动补平，或检查金额录入"
  });

  checks.push({
    item: "摘要填写",
    ok: !!document.querySelector("#voucherSummary").value.trim(),
    suggestion: "可点击【摘要智能联想】自动填充常用摘要"
  });

  const hasInvalidSubject = rows.some((r) => !getActiveBook().subjects.some((s) => s.code === r.subjectCode));
  checks.push({
    item: "科目有效性",
    ok: !hasInvalidSubject,
    suggestion: "请输入已初始化的科目编码"
  });

  const sameSide = rows.some((r) => r.debit > 0 && r.credit > 0);
  checks.push({
    item: "分录单边金额",
    ok: !sameSide,
    suggestion: "每行仅填写借方或贷方其中一侧"
  });

  el.aiCheckBody.innerHTML = "";
  checks.forEach((c) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${c.item}</td><td class="${c.ok ? "ok" : "warn"}">${c.ok ? "通过" : "异常"}</td><td>${c.ok ? "-" : c.suggestion}</td>`;
    el.aiCheckBody.appendChild(tr);
  });

  const passCount = checks.filter((c) => c.ok).length;
  el.aiHint.textContent = `智能纠错完成：${passCount}/${checks.length} 项通过`;
}

function rerenderAll() {
  renderBooks();
  renderSubjects();
  renderAssistProjects();
  renderVouchers();
  renderVoucherDetail();
  renderBalanceTable();
  renderLedger();
  renderCurrentReport();
  renderReportVersions();
  renderCurrentMerge();
  renderMergeVersions();
  resetEntryForm();
  el.aiCheckBody.innerHTML = "";
}

function bindEvents() {
  document.querySelector("#createBookBtn").addEventListener("click", () => {
    const name = document.querySelector("#bookNameInput").value.trim();
    if (!name) return alert("请输入账套名称");
    const legalEntity = document.querySelector("#legalEntityInput").value.trim() || "未命名法人";
    const isLegalEntity = document.querySelector("#isLegalEntityChk").checked;
    const id = `B${String(state.bookSeq).padStart(4, "0")}`;
    const b = emptyBook(id, name);
    b.legalEntity = legalEntity;
    b.isLegalEntity = isLegalEntity;
    state.books.push(b);
    state.bookSeq += 1;
    state.activeBookId = id;
    saveState();
    rerenderAll();
  });

  document.querySelector("#switchBookBtn").addEventListener("click", () => {
    state.activeBookId = el.activeBookSelect.value;
    saveState();
    rerenderAll();
  });

  el.bookTableBody.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-book-action]");
    if (!btn) return;
    state.activeBookId = btn.dataset.id;
    saveState();
    rerenderAll();
  });


  if (el.assistTypeSelect) {
    el.assistTypeSelect.addEventListener("change", () => {
      renderAssistProjects();
      refreshAssistOptionsInEntryRows();
    });
  }

  el.addOrgBtn?.addEventListener("click", () => {
    const err = addArchiveItem(
      "ORG",
      (el.orgCodeInput.value || "").trim(),
      (el.orgNameInput.value || "").trim(),
      {
        creditCode: (el.orgCreditCodeInput.value || "").trim(),
        address: (el.orgAddressInput.value || "").trim(),
        contact: (el.orgContactInput.value || "").trim(),
        phone: (el.orgPhoneInput.value || "").trim()
      }
    );
    if (err) return alert(err);
    [el.orgCodeInput, el.orgNameInput, el.orgCreditCodeInput, el.orgAddressInput, el.orgContactInput, el.orgPhoneInput].forEach((x) => { if (x) x.value = ""; });
  });

  el.addPersonBtn?.addEventListener("click", () => {
    const kind = el.personKindSelect?.value || "EXTERNAL";
    const deptId = el.personDeptSelect?.value || "";
    const book = getActiveBook();
    const dept = book.assistItems.find((x) => String(x.id) === String(deptId) && x.type === "DEPT");
    if (kind === "EMPLOYEE" && !dept) return alert("员工档案必须选择所属部门");

    const deptHistory = kind === "EMPLOYEE" && dept
      ? [{ deptId: dept.id, deptCode: dept.code, deptName: dept.name, date: document.querySelector("#voucherDate")?.value || toDateValue(new Date()) }]
      : [];

    const err = addArchiveItem(
      "PERSON",
      (el.personCodeInput.value || "").trim(),
      (el.personNameInput.value || "").trim(),
      {
        kind,
        idNo: (el.personIdNoInput.value || "").trim(),
        address: (el.personAddressInput.value || "").trim(),
        phone: (el.personPhoneInput.value || "").trim(),
        deptHistory
      }
    );
    if (err) return alert(err);
    [el.personCodeInput, el.personNameInput, el.personIdNoInput, el.personAddressInput, el.personPhoneInput].forEach((x) => { if (x) x.value = ""; });
  });

  el.addDeptBtn?.addEventListener("click", () => {
    const err = addArchiveItem(
      "DEPT",
      (el.deptCodeInput.value || "").trim(),
      (el.deptNameInput.value || "").trim(),
      { manager: (el.deptManagerInput.value || "").trim() }
    );
    if (err) return alert(err);
    [el.deptCodeInput, el.deptNameInput, el.deptManagerInput].forEach((x) => { if (x) x.value = ""; });
  });

  el.transferDeptBtn?.addEventListener("click", () => {
    const personId = el.transferPersonSelect?.value || "";
    const deptId = el.transferDeptSelect?.value || "";
    const date = el.transferDateInput?.value || toDateValue(new Date());
    const book = getActiveBook();
    const person = book.assistItems.find((x) => String(x.id) === String(personId) && x.type === "PERSON");
    const dept = book.assistItems.find((x) => String(x.id) === String(deptId) && x.type === "DEPT");
    if (!person) return alert("请选择需要变更部门的人员");
    if (!dept) return alert("请选择新部门");
    if ((person.meta?.kind || "EXTERNAL") !== "EMPLOYEE") return alert("仅员工档案可变更部门");
    person.meta = person.meta || {};
    person.meta.deptHistory = person.meta.deptHistory || [];
    person.meta.deptHistory.push({ deptId: dept.id, deptCode: dept.code, deptName: dept.name, date });
    person.meta.deptHistory.sort((a, b) => a.date.localeCompare(b.date));
    saveState();
    renderAssistProjects();
  });

  [el.orgTableBody, el.personTableBody, el.deptTableBody].forEach((tbody) => {
    tbody?.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-archive-action]");
      if (!btn) return;
      const book = getActiveBook();
      const target = book.assistItems.find((x) => String(x.id) === String(btn.dataset.id) && x.type === btn.dataset.type);
      if (!target) return;
      if (isAssistItemUsed(book, target)) return alert("该档案已在凭证中使用，不能删除");
      book.assistItems = book.assistItems.filter((x) => String(x.id) !== String(target.id));
      saveState();
      renderAssistProjects();
      refreshAssistOptionsInEntryRows();
    });
  });

  document.querySelector("#initSubjectsBtn").addEventListener("click", () => {
    const book = getActiveBook();
    const template = document.querySelector("#templateSelect").value;
    book.subjects = SUBJECT_TEMPLATES[template].map((s) => ({ ...s }));
    saveState();
    rerenderAll();
    alert(`账套 ${book.name} 科目初始化完成`);
  });

  el.downloadSubjectTemplateBtn?.addEventListener("click", () => {
    downloadCsv("科目导入模板.csv", subjectTemplateCsv());
  });

  el.importSubjectsBtn?.addEventListener("click", async () => {
    const file = el.subjectImportFile?.files?.[0];
    if (!file) return alert("请先选择CSV文件");
    const text = await file.text();
    const imported = importSubjectsFromCsv(text);
    if (!imported.length) return alert("未解析到有效科目，请检查模板格式");
    const book = getActiveBook();
    upsertSubjects(book, imported);
    saveState();
    rerenderAll();
    alert(`导入成功，共 ${imported.length} 条科目`);
  });

  el.addSubjectBtn?.addEventListener("click", () => {
    const book = getActiveBook();
    if (!book.subjects.length) return alert("请先初始化或导入科目后再新增");
    const code = (el.newSubjectCodeInput.value || "").trim();
    const name = (el.newSubjectNameInput.value || "").trim();
    const direction = el.newSubjectDirectionSelect.value || "借";
    if (!code || !name) return alert("新增科目编码和名称不能为空");
    if (book.subjects.some((s) => s.code === code)) return alert("科目编码已存在");
    book.subjects.push({ code, name, direction: direction === "贷" ? "贷" : "借" });
    book.subjects.sort((a, b) => a.code.localeCompare(b.code, "zh-Hans-CN"));
    el.newSubjectCodeInput.value = "";
    el.newSubjectNameInput.value = "";
    saveState();
    rerenderAll();
  });

  document.querySelector("#addRowBtn").addEventListener("click", () => addEntryRow());

  document.querySelector("#saveVoucherBtn").addEventListener("click", () => {
    const book = getActiveBook();
    pruneEmptyEntryRows();
    const entries = entryRowsToData();
    const voucher = {
      id: `V${String(book.seq).padStart(4, "0")}`,
      date: document.querySelector("#voucherDate").value,
      summary: document.querySelector("#voucherSummary").value.trim(),
      entries,
      totalDebit: entries.reduce((sum, e) => sum + e.debit, 0),
      totalCredit: entries.reduce((sum, e) => sum + e.credit, 0),
      status: "draft"
    };
    const err = assertVoucherValid(voucher, book);
    if (err) return alert(err);
    book.vouchers.push(voucher);
    book.seq += 1;
    saveState();
    rerenderAll();
    alert("凭证保存成功");
  });

  el.voucherTableBody.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;
    const book = getActiveBook();
    const v = book.vouchers.find((x) => x.id === btn.dataset.id);
    if (!v) return;
    if (btn.dataset.action === "view") {
      selectedVoucherId = btn.dataset.id;
      renderVoucherDetail();
      return;
    }
    if (btn.dataset.action === "delete") {
      if (v.status !== "draft") return alert("仅未审核未记账凭证可删除");
      book.vouchers = book.vouchers.filter((x) => x.id !== v.id);
      resequenceVouchers(book);
      selectedVoucherId = "";
      saveState();
      rerenderAll();
      return;
    }
    if (btn.dataset.action === "audit") {
      if (v.status !== "draft") return alert("仅草稿状态可审核");
      v.status = "audited";
    }
    if (btn.dataset.action === "post") {
      if (v.status !== "audited") return alert("仅已审核状态可记账");
      v.status = "posted";
    }
    if (btn.dataset.action === "unpost") {
      if (v.status !== "posted") return alert("仅已记账状态可反记账");
      v.status = "audited";
    }
    if (btn.dataset.action === "unaudit") {
      if (v.status !== "audited") return alert("仅已审核状态可反审核");
      v.status = "draft";
    }
    saveState();
    rerenderAll();
  });

  document.querySelector("#refreshBalanceBtn").addEventListener("click", renderBalanceTable);
  document.querySelector("#refreshLedgerBtn").addEventListener("click", renderLedger);
  el.balanceTableBody.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-ledger-subject]");
    if (!btn) return;
    el.ledgerSubjectSelect.value = btn.dataset.ledgerSubject;
    renderLedger();
  });

  document.querySelector("#generateReportBtn").addEventListener("click", () => {
    const book = getActiveBook();
    const startDate = document.querySelector("#reportStartDate").value;
    const endDate = document.querySelector("#reportEndDate").value;
    const type = document.querySelector("#reportTypeSelect").value;
    if (!startDate || !endDate) return alert("请先选择报表期间");
    if (endDate < startDate) return alert("结束日期不能早于开始日期");
    const report = { id: `R${String(book.reportSeq).padStart(4, "0")}`, type, startDate, endDate, generatedAt: new Date().toLocaleString(), rows: buildReportRows(book, type, startDate, endDate) };
    book.reportSeq += 1;
    book.reportVersions.push(report);
    book.currentReportId = report.id;
    saveState();
    rerenderAll();
  });

  document.querySelector("#recomputeReportBtn").addEventListener("click", () => {
    const book = getActiveBook();
    const startDate = document.querySelector("#reportStartDate").value;
    const endDate = document.querySelector("#reportEndDate").value;
    const type = document.querySelector("#reportTypeSelect").value;
    if (!startDate || !endDate) return alert("请先选择报表期间");
    if (endDate < startDate) return alert("结束日期不能早于开始日期");
    const report = { id: `R${String(book.reportSeq).padStart(4, "0")}-R`, type, startDate, endDate, generatedAt: new Date().toLocaleString(), rows: buildReportRows(book, type, startDate, endDate) };
    book.reportSeq += 1;
    book.reportVersions.push(report);
    book.currentReportId = report.id;
    saveState();
    rerenderAll();
  });

  document.querySelector("#exportCurrentReportBtn").addEventListener("click", () => {
    const book = getActiveBook();
    const cur = book.reportVersions.find((r) => r.id === book.currentReportId);
    if (!cur) return alert("当前没有可导出的报表");
    downloadCsv(`${book.name}-${cur.id}-${reportTypeName(cur.type)}.csv`, reportToCsv(cur, `${book.name}个别报表`));
  });

  el.saveReportEditBtn?.addEventListener("click", () => {
    const book = getActiveBook();
    const cur = book.reportVersions.find((r) => r.id === book.currentReportId);
    if (!cur) return alert("当前没有可编辑报表");
    const names = [...el.reportTableBody.querySelectorAll('input[data-report-edit="name"]')];
    const values = [...el.reportTableBody.querySelectorAll('input[data-report-edit="value"]')];
    cur.rows = names.map((n, i) => [n.value.trim() || `项目${i + 1}`, parseAmount(values[i]?.value || "0")]);
    saveState();
    rerenderAll();
    alert("报表格式与内容已保存");
  });

  el.importReportBtn?.addEventListener("click", async () => {
    const file = el.reportImportFile?.files?.[0];
    if (!file) return alert("请选择报表文件（建议Excel另存为CSV）");
    const text = await file.text();
    const rows = parseReportRowsFromCsv(text);
    if (!rows.length) return alert("导入失败：未解析到报表行");
    const book = getActiveBook();
    const startDate = document.querySelector("#reportStartDate").value || toDateValue(new Date());
    const endDate = document.querySelector("#reportEndDate").value || toDateValue(new Date());
    const type = document.querySelector("#reportTypeSelect").value;
    const report = { id: `R${String(book.reportSeq).padStart(4, "0")}-I`, type, startDate, endDate, generatedAt: new Date().toLocaleString(), rows };
    book.reportSeq += 1;
    book.reportVersions.push(report);
    book.currentReportId = report.id;
    saveState();
    rerenderAll();
  });

  el.reportVersionBody.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-report-action]");
    if (!btn) return;
    const book = getActiveBook();
    const report = book.reportVersions.find((r) => r.id === btn.dataset.id);
    if (!report) return;
    if (btn.dataset.reportAction === "view") {
      book.currentReportId = report.id;
      saveState();
      rerenderAll();
      return;
    }
    downloadCsv(`${book.name}-${report.id}-${reportTypeName(report.type)}.csv`, reportToCsv(report, `${book.name}个别报表`));
  });

  document.querySelector("#generateMergeBtn").addEventListener("click", () => {
    const startDate = document.querySelector("#mergeStartDate").value;
    const endDate = document.querySelector("#mergeEndDate").value;
    const type = document.querySelector("#mergeTypeSelect").value;
    if (!startDate || !endDate) return alert("请先选择合并期间");
    if (endDate < startDate) return alert("结束日期不能早于开始日期");
    const selectedIds = [...document.querySelectorAll("input[data-merge-book]:checked")].map((x) => x.dataset.mergeBook);
    if (!selectedIds.length) return alert("请至少选择一个账套用于合并");
    const selectedBooks = state.books.filter((b) => selectedIds.includes(b.id));
    const aggregate = new Map();
    selectedBooks.forEach((book) => {
      buildReportRows(book, type, startDate, endDate).forEach(([name, value]) => {
        aggregate.set(name, (aggregate.get(name) || 0) + value);
      });
    });
    const merge = { id: `MR${String(state.mergeSeq).padStart(4, "0")}`, type, startDate, endDate, bookIds: selectedBooks.map((b) => b.id), bookNames: selectedBooks.map((b) => b.name), generatedAt: new Date().toLocaleString(), rows: [...aggregate.entries()] };
    state.mergeSeq += 1;
    state.mergeVersions.push(merge);
    state.currentMergeId = merge.id;
    saveState();
    rerenderAll();
  });

  document.querySelector("#exportCurrentMergeBtn").addEventListener("click", () => {
    const cur = state.mergeVersions.find((m) => m.id === state.currentMergeId);
    if (!cur) return alert("当前没有可导出的合并报表");
    downloadCsv(`${cur.id}-${reportTypeName(cur.type)}.csv`, reportToCsv(cur, `合并范围:${cur.bookNames.join("+")}`));
  });

  el.mergeVersionBody.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-merge-action]");
    if (!btn) return;
    const report = state.mergeVersions.find((m) => m.id === btn.dataset.id);
    if (!report) return;
    if (btn.dataset.mergeAction === "view") {
      state.currentMergeId = report.id;
      saveState();
      rerenderAll();
      return;
    }
    downloadCsv(`${report.id}-${reportTypeName(report.type)}.csv`, reportToCsv(report, `合并范围:${report.bookNames.join("+")}`));
  });

  document.querySelector("#suggestSummaryBtn").addEventListener("click", () => {
    const suggestion = aiSuggestSummary(document.querySelector("#aiScenarioInput").value.trim());
    document.querySelector("#voucherSummary").value = suggestion;
    el.aiHint.textContent = `摘要建议：${suggestion}`;
  });

  document.querySelector("#aiGenerateVoucherBtn").addEventListener("click", () => {
    const scenario = document.querySelector("#aiScenarioInput").value;
    aiGenerateVoucherDraft(scenario);
  });

  document.querySelector("#smartCheckBtn").addEventListener("click", aiSmartCheck);
}

function boot() {
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  document.querySelector("#voucherDate").value = toDateValue(today);
  document.querySelector("#reportStartDate").value = toDateValue(monthStart);
  document.querySelector("#reportEndDate").value = toDateValue(today);
  document.querySelector("#mergeStartDate").value = toDateValue(monthStart);
  document.querySelector("#mergeEndDate").value = toDateValue(today);

  rerenderAll();
  bindEvents();
  el.aiHint.textContent = "可使用 AI 生成凭证草稿和智能纠错";
}

boot();
