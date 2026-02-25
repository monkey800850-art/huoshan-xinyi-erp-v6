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
  assistCodeInput: document.querySelector("#assistCodeInput"),
  assistNameInput: document.querySelector("#assistNameInput"),
  assistTableBody: document.querySelector("#assistTable tbody")
};

function getActiveBook() {
  return state.books.find((b) => b.id === state.activeBookId) || state.books[0];
}

function reportTypeName(type) {
  return type === "bs" ? "资产负债表" : type === "pl" ? "利润表" : "现金流量表";
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

function renderAssistProjects() {
  const book = getActiveBook();
  if (!el.assistTableBody) return;
  const type = el.assistTypeSelect ? el.assistTypeSelect.value : "";
  const rows = type ? book.assistItems.filter((x) => x.type === type) : book.assistItems;
  el.assistTableBody.innerHTML = "";
  rows.forEach((a) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${a.id}</td><td>${assistTypeName(a.type)}</td><td>${a.code}</td><td>${a.name}</td><td><button data-assist-action="delete" data-id="${a.id}">删除</button></td>`;
    el.assistTableBody.appendChild(tr);
  });
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
    movements.forEach((m) => {
      const bal = m.direction === "借" ? m.debit - m.credit : m.credit - m.debit;
      if (m.code.startsWith("1")) assets += bal;
      else if (m.code.startsWith("2")) liabilities += bal;
      else if (m.code.startsWith("3") || m.code.startsWith("4")) equity += bal;
    });
    if (equity === 0) equity = assets - liabilities;
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
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${v.id}</td><td>${v.date}</td><td>${v.summary}</td><td>${money(v.totalDebit)}</td><td>${money(v.totalCredit)}</td><td class="${statusCls}">${v.status}</td><td><button data-action="audit" data-id="${v.id}">审核</button><button data-action="post" data-id="${v.id}">记账</button></td>`;
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
  cur.rows.forEach(([n, v]) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${n}</td><td>${money(v)}</td>`;
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
  const amountMatch = text.match(/(\d+(?:\.\d+)?)/);
  const amount = amountMatch ? Number(amountMatch[1]) : 1000;

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

  document.querySelector("#addAssistBtn")?.addEventListener("click", () => {
    const book = getActiveBook();
    const type = el.assistTypeSelect.value;
    const code = (el.assistCodeInput.value || "").trim();
    const name = (el.assistNameInput.value || "").trim();
    if (!code || !name) return alert("辅助项编码和名称不能为空");
    if (book.assistItems.some((x) => x.type === type && x.code === code)) return alert("同类别下编码已存在");
    book.assistItems.push({ id: book.assistSeq++, type, code, name });
    el.assistCodeInput.value = "";
    el.assistNameInput.value = "";
    saveState();
    renderAssistProjects();
    refreshAssistOptionsInEntryRows();
  });

  el.assistTableBody?.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-assist-action]");
    if (!btn) return;
    const book = getActiveBook();
    if (btn.dataset.assistAction === "delete") {
      book.assistItems = book.assistItems.filter((x) => String(x.id) !== String(btn.dataset.id));
      saveState();
      renderAssistProjects();
      refreshAssistOptionsInEntryRows();
    }
  });

  document.querySelector("#initSubjectsBtn").addEventListener("click", () => {
    const book = getActiveBook();
    const template = document.querySelector("#templateSelect").value;
    book.subjects = SUBJECT_TEMPLATES[template].map((s) => ({ ...s }));
    saveState();
    rerenderAll();
    alert(`账套 ${book.name} 科目初始化完成`);
  });

  document.querySelector("#addRowBtn").addEventListener("click", () => addEntryRow());

  document.querySelector("#saveVoucherBtn").addEventListener("click", () => {
    const book = getActiveBook();
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
    if (btn.dataset.action === "audit") {
      if (v.status !== "draft") return alert("仅草稿状态可审核");
      v.status = "audited";
    }
    if (btn.dataset.action === "post") {
      if (v.status !== "audited") return alert("仅已审核状态可记账");
      v.status = "posted";
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
