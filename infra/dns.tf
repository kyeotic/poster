data "cloudflare_zone" "kye_dev" {
  name = var.zone_name
}

data "external" "pages_subdomain" {
  program = ["bash", "-c", "bash <(curl -sf 'https://gist.githubusercontent.com/kyeotic/a9a3ed42bb7be6b66d58cf70053da977/raw/get_pages_subdomain.sh')"]
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
