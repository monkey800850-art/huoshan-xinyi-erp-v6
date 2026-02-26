# Phoenix 后端 M1 设计与最小实现

本目录包含：

1. 数据库表设计：`sql/schema.sql`
2. REST API 清单：`api/rest-api-list.md`
3. 推荐目录结构：`dir-tree.md`
4. 最小可运行后端：`src/server.js`

## 已实现（本次）
- `book/subject/voucher` 三个核心模块（API 级）
- 最短链路：`创建凭证 -> 审核 -> 记账 -> 余额表查询`
- 会计期间开关控制（结账后禁止凭证创建/审核/记账）
- 批量审核与批量记账接口

## 快速运行

```bash
cd backend/m1
node src/server.js
```

默认端口：`9090`

## 冒烟测试

```bash
cd backend/m1
node tests/smoke.mjs
```

