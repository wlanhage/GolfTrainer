### 1 Start backend (Supabase default)

```bash
# backend against local DB
npm --prefix backend run dev:local

# backend against supabase DB
npm --prefix backend run dev
```

### 2 Start mobile

```bash
# start mobile frontend
npm --prefix mobile start
```

### 3 Start admin 

```bash
# start admin web frontend
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
