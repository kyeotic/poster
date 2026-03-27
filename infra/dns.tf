data "cloudflare_zone" "kye_dev" {
  name = var.zone_name
}

data "external" "pages_subdomain" {
  program = ["${path.module}/scripts/get_pages_subdomain.sh"]
  query = {
    account_id   = local.cloudflare_account_id
    project_name = "poster"
  }
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
  content = data.external.pages_subdomain.result.subdomain
  proxied = true
}
