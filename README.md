# Phoenix M1 + M2 + M3 + M4 Prototype

纯前端（HTML/CSS/JS）财务原型：

## M1
- 科目体系初始化（小企业/企业会计准则模板）
- 凭证录入（Enter 新增行，`=` 自动平衡最后一行）
- 凭证审核、记账流程
- 发生余额表（基于已记账凭证）
- 科目明细账查询

## M2
- 个别财务报表生成（资产负债表、利润表、现金流量表）
- 报表按期间生成
- 报表重算生成新版本
- 报表版本留痕
- 当前报表与历史版本 CSV 导出

## M3
- 多账套管理（新建账套、切换账套、每账套独立核算数据）
- 各账套独立凭证与个别报表
- 多账套组合生成合并报表
- 合并报表版本留痕与 CSV 导出

## M4
- 摘要智能联想（常用摘要建议）
- AI 业务描述生成凭证草稿（自动填充分录）
- 智能纠错检查（借贷平衡、摘要、科目有效性、分录单边金额）

## 运行

```bash
python -m http.server 8000
```

打开：`http://localhost:8000/app/`

## 后端 M1 设计文档
- 数据库：`backend/m1/sql/schema.sql`
- API 清单：`backend/m1/api/rest-api-list.md`
- 目录结构：`backend/m1/dir-tree.md`

- 后端最小实现：`backend/m1/src/server.js`
- 后端冒烟测试：`backend/m1/tests/smoke.mjs`


## Win11 一键启动（PowerShell）
```powershell
./start-dev.ps1
```

可选端口：
```powershell
./start-dev.ps1 -FrontendPort 8001 -BackendPort 9091
```
