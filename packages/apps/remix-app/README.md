# Welcome to Remix!

- 📖 [Remix docs](https://remix.run/docs)

## Development

Run the dev server:

```shellscript
npm run dev
```

## Deployment

First, build your app for production:

```sh
npm run build
```

Then run the app in production mode:

```sh
npm start
```

Now you'll need to pick a host to deploy it to.

### DIY

If you're familiar with deploying Node applications, the built-in Remix app server is production-ready.

Make sure to deploy the output of `npm run build`

- `build/server`
- `build/client`

## Debug

```bash
localStorage.debug = '*:*'
```

## Styling

This template comes with [Tailwind CSS](https://tailwindcss.com/) already configured for a simple default starting experience. You can use whatever css framework you prefer. See the [Vite docs on css](https://vitejs.dev/guide/features.html#css) for more information.

## Customization

```bash
# generate service worker
pnpx remix-pwa sw
pnpx remix-pwa manifest

# add shadcn components
pnpx shadcn@latest add {component}
pnpm dlx shadcn@latest add {component}
```

## Links

- https://lucide.dev/
- https://ui.shadcn.com/
