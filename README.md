# project-v

> undefined project - ρV.

## development

```bash
## npm
npm install -g @microsoft/rush
## or pnpm
pnpm add -g @microsoft/rush
```

## deploy

```bash
rush install
rush build
rush deploy -p remix-app -s remix-app --overwrite
```
