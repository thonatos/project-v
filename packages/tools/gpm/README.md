# gpm

`gpm` clones Git repositories into predictable `<root>/<host>/<repository-path>` directories.

## Commands

```console
gpm init
gpm clone https://github.com/thonatos/project-v.git
gpm help
gpm version
```

`gpm init` creates `~/.gpmrc` with one absolute root:

```json
{ "root": ["/absolute/path/to/gpm"] }
```

The native binary is built with `scriptc` and does not require Node.js or `node_modules` at runtime. Building requires Node.js 24+, pnpm, scriptc, and clang. Cloning requires `git` in `PATH`.
