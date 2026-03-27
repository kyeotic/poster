data "cloudflare_zone" "kye_dev" {
  name = var.zone_name
}

resource "cloudflare_pages_domain" "poster" {
  account_id   = local.cloudflare_account_id
  project_name = "poster"
  domain       = var.domain_name
}

resource "cloudflare_record" "poster" {
  zone_id = data.cloudflare_zone.kye_dev.id
  name    = "poster"
  type    = "CNAME"
  content = "poster.pages.dev"
  proxied = true
}
