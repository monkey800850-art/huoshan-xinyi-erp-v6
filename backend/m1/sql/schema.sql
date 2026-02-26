-- Phoenix M1 后端数据库表设计（PostgreSQL）
-- 目标：科目初始化、凭证录入/审核/记账、发生余额表、明细账

-- ========== 1) 账套与会计期间 ==========
create table if not exists m1_book (
  id                bigserial primary key,
  book_code         varchar(32) not null unique,
  book_name         varchar(128) not null,
  legal_entity_name varchar(128) not null,
  status            varchar(16) not null default 'ACTIVE', -- ACTIVE/INACTIVE
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table if not exists m1_period (
  id                bigserial primary key,
  book_id           bigint not null references m1_book(id),
  fiscal_year       int not null,
  period_no         int not null check (period_no between 1 and 12),
  start_date        date not null,
  end_date          date not null,
  close_status      varchar(16) not null default 'OPEN', -- OPEN/CLOSED
  unique (book_id, fiscal_year, period_no)
);

-- ========== 2) 科目体系 ==========
create table if not exists m1_subject (
  id                bigserial primary key,
  book_id           bigint not null references m1_book(id),
  subject_code      varchar(32) not null,
  subject_name      varchar(128) not null,
  subject_level     int not null default 1,
  parent_id         bigint null references m1_subject(id),
  direction         varchar(8) not null, -- DEBIT/CREDIT
  is_leaf           boolean not null default true,
  is_enabled        boolean not null default true,
  unique (book_id, subject_code)
);

create index if not exists idx_m1_subject_book_parent on m1_subject(book_id, parent_id);

-- ========== 3) 凭证主子表 ==========
create table if not exists m1_voucher (
  id                bigserial primary key,
  book_id           bigint not null references m1_book(id),
  voucher_no        varchar(64) not null,
  voucher_date      date not null,
  fiscal_year       int not null,
  period_no         int not null,
  summary           varchar(255) not null,
  status            varchar(16) not null default 'DRAFT', -- DRAFT/AUDITED/POSTED/VOID
  total_debit       numeric(18,2) not null default 0,
  total_credit      numeric(18,2) not null default 0,
  source_type       varchar(32) not null default 'MANUAL', -- MANUAL/BIZCHAIN/AI
  created_by        varchar(64) not null,
  audited_by        varchar(64),
  posted_by         varchar(64),
  created_at        timestamptz not null default now(),
  audited_at        timestamptz,
  posted_at         timestamptz,
  unique (book_id, voucher_no)
);

create index if not exists idx_m1_voucher_book_date on m1_voucher(book_id, voucher_date);
create index if not exists idx_m1_voucher_book_period on m1_voucher(book_id, fiscal_year, period_no);

create table if not exists m1_voucher_entry (
  id                bigserial primary key,
  voucher_id        bigint not null references m1_voucher(id) on delete cascade,
  line_no           int not null,
  subject_id        bigint not null references m1_subject(id),
  assist_type       varchar(64),
  assist_code       varchar(64),
  assist_name       varchar(128),
  entry_summary     varchar(255),
  debit_amount      numeric(18,2) not null default 0,
  credit_amount     numeric(18,2) not null default 0,
  check (debit_amount >= 0 and credit_amount >= 0),
  check ((debit_amount = 0 and credit_amount > 0) or (debit_amount > 0 and credit_amount = 0)),
  unique (voucher_id, line_no)
);

create index if not exists idx_m1_entry_subject on m1_voucher_entry(subject_id);

-- ========== 4) 余额快照（加速发生余额表） ==========
create table if not exists m1_subject_balance (
  id                bigserial primary key,
  book_id           bigint not null references m1_book(id),
  subject_id        bigint not null references m1_subject(id),
  fiscal_year       int not null,
  period_no         int not null,
  opening_debit     numeric(18,2) not null default 0,
  opening_credit    numeric(18,2) not null default 0,
  occur_debit       numeric(18,2) not null default 0,
  occur_credit      numeric(18,2) not null default 0,
  closing_debit     numeric(18,2) not null default 0,
  closing_credit    numeric(18,2) not null default 0,
  unique (book_id, subject_id, fiscal_year, period_no)
);

create index if not exists idx_m1_balance_book_period on m1_subject_balance(book_id, fiscal_year, period_no);

-- ========== 5) 操作留痕 ==========
create table if not exists m1_audit_log (
  id                bigserial primary key,
  book_id           bigint references m1_book(id),
  biz_type          varchar(32) not null, -- VOUCHER/SUBJECT/REPORT/PERIOD
  biz_id            varchar(64) not null,
  action            varchar(32) not null, -- CREATE/UPDATE/AUDIT/POST/VOID
  operator          varchar(64) not null,
  before_json       jsonb,
  after_json        jsonb,
  created_at        timestamptz not null default now()
);

create index if not exists idx_m1_audit_biz on m1_audit_log(biz_type, biz_id, created_at);
