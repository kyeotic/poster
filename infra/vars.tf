#-------------------------------------------
# Required variables (do not add defaults here!)
#-------------------------------------------

#-------------------------------------------
# Configurable variables
#-------------------------------------------
variable "cloudflare_account_name" {
  default = "tim@kye.dev"
}

variable "region" {
  default = "us-west-2"
}

variable "domain_name" {
  default = "poster.kye.dev"
}

variable "zone_name" {
  default = "kye.dev"
}

variable "deno_deploy_acme" {
  default = "a52fb6e8a1e5fee2508fa6f5._acme.deno.dev."
}
