# Phoenix 后端 M1 推荐目录结构

```text
backend/
└── m1/
    ├── README.md
    ├── dir-tree.md
    ├── sql/
    │   └── schema.sql
    ├── api/
    │   └── rest-api-list.md
    └── src/
        ├── app.(java|kt|ts)
        ├── config/
        │   ├── datasource-config.(java|kt|ts)
        │   ├── schema-routing-interceptor.(java|kt|ts)
        │   └── security-config.(java|kt|ts)
        ├── middleware/
        │   ├── tenant-context.(java|kt|ts)
        │   ├── auth-middleware.(java|kt|ts)
        │   └── audit-middleware.(java|kt|ts)
        ├── controllers/
        │   ├── book-controller.(java|kt|ts)
        │   ├── subject-controller.(java|kt|ts)
        │   ├── voucher-controller.(java|kt|ts)
        │   ├── report-controller.(java|kt|ts)
        │   └── audit-log-controller.(java|kt|ts)
        ├── services/
        │   ├── book-service.(java|kt|ts)
        │   ├── period-service.(java|kt|ts)
        │   ├── subject-service.(java|kt|ts)
        │   ├── voucher-service.(java|kt|ts)
        │   ├── posting-service.(java|kt|ts)
        │   ├── trial-balance-service.(java|kt|ts)
        │   └── ledger-service.(java|kt|ts)
        ├── repositories/
        │   ├── book-repository.(java|kt|ts)
        │   ├── subject-repository.(java|kt|ts)
        │   ├── voucher-repository.(java|kt|ts)
        │   ├── voucher-entry-repository.(java|kt|ts)
        │   ├── balance-repository.(java|kt|ts)
        │   └── audit-log-repository.(java|kt|ts)
        ├── dto/
        │   ├── request/
        │   └── response/
        └── models/
            ├── book.(java|kt|ts)
            ├── period.(java|kt|ts)
            ├── subject.(java|kt|ts)
            ├── voucher.(java|kt|ts)
            ├── voucher-entry.(java|kt|ts)
            ├── subject-balance.(java|kt|ts)
            └── audit-log.(java|kt|ts)
```

> 说明：上面是语言无关结构，可按技术栈落地为 Spring Boot / NestJS / Go Fiber 等。
