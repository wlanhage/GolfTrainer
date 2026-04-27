### 1 Start backend (Supabase default)

```bash
# backend against local DB
npm --prefix backend run dev:local

# backend against supabase DB
npm --prefix backend run dev
```

### 2 Start admin web

```bash
# backend against local DB
npm --prefix backend run dev:local

# backend against supabase DB
npm --prefix backend run dev
```

### 3 Start mobile frontend

```bash
cd admin-web
npm run dev
```


### 4 Push DB

```bash
# push schema to local DB
npm --prefix backend run prisma:db:push:local

# push schema to supabase DB
npm --prefix backend run prisma:db:push:supabase
```
