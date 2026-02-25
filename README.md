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


## Git 初始化与推送常见问题（Linux/WSL）

如果你在 `git commit` 或 `git push` 时看到类似报错：
- `Author identity unknown`
- `fatal: empty ident name`
- `error: remote origin already exists`
- `error: src refspec work does not match any`

可按下面步骤处理：

```bash
# 1) 配置提交身份（至少配置当前仓库一次）
git config user.name "Your Name"
git config user.email "you@example.com"

# 如需全局生效（可选）
# git config --global user.name "Your Name"
# git config --global user.email "you@example.com"

# 2) 确认仓库已有文件变更并完成首次提交
git status
git add .
git commit -m "init phoenix local workspace"

# 3) 处理 origin 已存在
# 查看当前远程
git remote -v
# 如果 URL 不对，先删除再重加
git remote remove origin
git remote add origin https://github.com/monkey800850-art/huoshan-xinyi-erp-v6.git

# 4) 创建并切换到工作分支
# 若分支不存在：
git checkout -b work
# 若分支已存在：
# git checkout work

# 5) 推送（首次推送需要 -u 建立跟踪）
git push -u origin work
```

### 错误含义速查
- `Author identity unknown` / `empty ident name`：未配置 `user.name`/`user.email`。
- `remote origin already exists`：远程别名 `origin` 已存在，不必重复添加；如 URL 错误请先 `git remote remove origin`。
- `src refspec work does not match any`：通常是**分支还没有任何提交**，先成功 commit 再 push。
