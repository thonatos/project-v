# remix-flow

## deploy

```bash
rush install
rush build -t remix-flow
rush deploy -p remix-flow -s remix-flow --overwrite

# or
npx wrangler deploy
```

## trigger

```js
{
  "url": "https://remix.implements.io/post/6aa74f1d-336d-4d3d-bd16-cff64e94b55f",
  "key": "6aa74f1d-336d-4d3d-bd16-cff64e94b55f",
  "selector": "#open-graph"
}
```
