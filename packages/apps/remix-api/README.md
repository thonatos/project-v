# remix-api

## develop

```bash
rush install
rush update
rushx dev
```

## deploy

```bash
rush install
rush build -t remix-api
rush deploy -p remix-api -s remix-api --overwrite

# or
npx wrangler deploy --env production
```
