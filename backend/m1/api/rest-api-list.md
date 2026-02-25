# Phoenix M1 REST API 清单

## 1. 通用约定
- Base URL: `/api/v1`
- Header: `X-Book-Code`（当前账套）
- 认证：`Authorization: Bearer <token>`
- 返回格式：
  - `code`：0 成功，非 0 失败
  - `message`：错误信息
  - `data`：业务数据

---

## 2. 账套与期间

### 2.1 新建账套
- `POST /books`

### 2.2 查询账套列表
- `GET /books`

### 2.3 会计期间初始化
- `POST /books/{bookId}/periods/init`

### 2.4 期间结账
- `POST /periods/{periodId}/close`

### 2.5 反结账
- `POST /periods/{periodId}/reopen`

---

## 3. 科目体系

### 3.1 按模板初始化科目
- `POST /subjects/init`
- Body: `{ "template": "small|enterprise" }`

### 3.2 科目列表（树/平铺）
- `GET /subjects?view=tree|flat&keyword=`

### 3.3 新增科目
- `POST /subjects`

### 3.4 修改科目
- `PUT /subjects/{subjectId}`

### 3.5 启停用科目
- `PATCH /subjects/{subjectId}/status`

---

## 4. 凭证

### 4.1 创建凭证（含分录）
- `POST /vouchers`

### 4.2 查询凭证列表
- `GET /vouchers?dateFrom=&dateTo=&status=&keyword=&page=&size=`

### 4.3 查询凭证详情
- `GET /vouchers/{voucherId}`

### 4.4 更新凭证（仅草稿）
- `PUT /vouchers/{voucherId}`

### 4.5 审核凭证
- `POST /vouchers/{voucherId}/audit`

### 4.6 批量审核凭证
- `POST /vouchers/audit/batch`

### 4.7 记账凭证
- `POST /vouchers/{voucherId}/post`

### 4.8 批量记账凭证
- `POST /vouchers/post/batch`

### 4.9 作废凭证
- `POST /vouchers/{voucherId}/void`

---

## 5. 账表查询

### 5.1 发生余额表
- `GET /reports/trial-balance?fiscalYear=&periodNo=&subjectCode=&assistType=&assistCode=&expandLevel=`

### 5.2 科目明细账
- `GET /reports/subject-ledger?subjectCode=&dateFrom=&dateTo=&assistType=&assistCode=&page=&size=`

### 5.3 辅助明细账
- `GET /reports/assist-ledger?assistType=&assistCode=&dateFrom=&dateTo=&page=&size=`

### 5.4 凭证穿透查询
- `GET /reports/voucher-drilldown?voucherNo=`

---

## 6. 审计与留痕

### 6.1 操作日志查询
- `GET /audit-logs?bizType=&bizId=&dateFrom=&dateTo=&page=&size=`

### 6.2 凭证版本轨迹
- `GET /vouchers/{voucherId}/history`

---

## 7. M4（为后续预留）
- `POST /ai/summary/suggest`
- `POST /ai/voucher/draft`
- `POST /ai/voucher/check`
