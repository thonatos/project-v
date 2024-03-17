# artusx-api

## develop

```bash
rush install
rush update
rushx dev
```

## deploy

```bash
rush install
rush build -t artusx-api
rush deploy -p artusx-api -s artusx-api --overwrite
```

## build

```bash
# docker build -t artusx-api .
# docker tag artusx-api 192.168.1.209:5000/artusx-api

docker build -t 192.168.1.209:5000/artusx-api .
docker push 192.168.1.209:5000/artusx-api
```
