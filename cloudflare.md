# Cloudflare Pages Migration

Migrating from Deno Deploy (classic/v1) to Cloudflare Pages.

## What changed (already done)

- Removed `packageManager` (pnpm) from `package.json`
- Deleted `pnpm-workspace.yaml` and `pnpm-lock.yaml`
- Replaced `deploy:deno` script with `deploy:cf` using `wrangler pages deploy`
- Added `wrangler` to devDependencies

## Steps to complete

### 1. Reinstall dependencies with npm

```bash
npm install
```

This generates `package-lock.json` and installs wrangler.

### 2. Authenticate with Cloudflare

```bash
npx wrangler login
```

### 3. Create the Pages project (one-time)

```bash
npx wrangler pages project create poster --production-branch main
```

### 4. Add `wrangler.toml`

Create at the repo root:

```toml
name = "poster"
pages_build_output_dir = "dist"
```

This allows running `npm run deploy` without repeating CLI flags.

### 5. Deploy

```bash
npm run deploy
```

This runs `vite build` then `wrangler pages deploy dist/ --project-name poster`.

The site will be live at `poster.pages.dev`.

### 6. Custom domain: poster.kye.dev

The Cloudflare DNS zone for `kye.dev` is already managed via Terraform in `infra/`.

Update `infra/dns.tf`:
- Remove the Deno Deploy ACME TXT record and CNAME
- Add a `cloudflare_pages_domain` resource to attach `poster.kye.dev` to the project
- Add a CNAME record: `poster` → `poster.pages.dev`

```hcl
resource "cloudflare_pages_domain" "poster" {
  account_id   = var.cloudflare_account_id
  project_name = "poster"
  domain       = "poster.kye.dev"
}

resource "cloudflare_record" "poster" {
  zone_id = var.cloudflare_zone_id
  name    = "poster"
  type    = "CNAME"
  value   = "poster.pages.dev"
  proxied = true
}
```

Then apply:

```bash
cd infra && ./deploy
```

### 7. Clean up

- Remove `deno.json` `deploy2` block (or delete the file if unused)
- Remove `deployctl` if installed globally

## Notes

- SPA routing: Cloudflare Pages serves `index.html` for unknown paths by default when there is no `_redirects` file. If client-side routing breaks (404s on deep links), add a `public/_redirects` file:
  ```
  /* /index.html 200
  ```
- `.npmrc` already has `@jsr:registry=https://npm.jsr.io` which works with npm, so `@std/ulid` will resolve correctly.
