variable "resource_group_name" { type = string }
variable "location" { type = string }
variable "suffix" { type = string }
variable "tags" { type = map(string) }

# NOTE: Basic SKU does not support Private Endpoint or AAD auth.
# This is a deliberate cost compromise for the demo. Cart-service uses the
# access key from Key Vault (the only key-based connection in the stack).
# Upgrade to Standard if you need PE or AAD.
resource "azurerm_redis_cache" "redis" {
  name                          = "redis-${var.suffix}"
  resource_group_name           = var.resource_group_name
  location                      = var.location
  capacity                      = 0
  family                        = "C"
  sku_name                      = "Basic"
  non_ssl_port_enabled          = false
  minimum_tls_version           = "1.2"
  public_network_access_enabled = true
  tags                          = var.tags

  redis_configuration {}
}

output "id" { value = azurerm_redis_cache.redis.id }
output "name" { value = azurerm_redis_cache.redis.name }
output "hostname" { value = azurerm_redis_cache.redis.hostname }
output "ssl_port" { value = azurerm_redis_cache.redis.ssl_port }
output "primary_access_key" {
  value     = azurerm_redis_cache.redis.primary_access_key
  sensitive = true
}
