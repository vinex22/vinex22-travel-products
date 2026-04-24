variable "resource_group_name" { type = string }
variable "location" { type = string }
variable "suffix" { type = string }
variable "tags" { type = map(string) }
variable "aad_admin_object_id" { type = string }
variable "aad_admin_principal" { type = string }
variable "uami_principal_id" { type = string }
variable "uami_client_id" { type = string }
variable "uami_name" { type = string }

# PostgreSQL Flexible Server — Entra-only auth, three databases.
# Public network access enabled — see ADR-014.
resource "azurerm_postgresql_flexible_server" "pg" {
  name                = "pg-${var.suffix}"
  resource_group_name = var.resource_group_name
  location            = var.location
  version             = "16"
  sku_name            = "B_Standard_B1ms" # Burstable, cheapest
  storage_mb          = 32768
  zone                = "1"

  # NO password auth — Entra only
  authentication {
    active_directory_auth_enabled = true
    password_auth_enabled         = false
    tenant_id                     = data.azurerm_client_config.current.tenant_id
  }

  # Public for now; PE-flip later
  public_network_access_enabled = true

  tags = var.tags

  lifecycle {
    ignore_changes = [zone, high_availability, administrator_login, administrator_password]
  }
}

data "azurerm_client_config" "current" {}

# Open firewall to all Azure + the world (Phase 0). Toggle script narrows this.
resource "azurerm_postgresql_flexible_server_firewall_rule" "all_azure" {
  name             = "AllowAllAzureServices"
  server_id        = azurerm_postgresql_flexible_server.pg.id
  start_ip_address = "0.0.0.0"
  end_ip_address   = "0.0.0.0"
}

resource "azurerm_postgresql_flexible_server_firewall_rule" "world" {
  name             = "AllowAll-Phase0"
  server_id        = azurerm_postgresql_flexible_server.pg.id
  start_ip_address = "0.0.0.0"
  end_ip_address   = "255.255.255.255"
}

# Entra admin = signed-in user (so scripts/bootstrap-pg.sh can connect with `az login`)
resource "azurerm_postgresql_flexible_server_active_directory_administrator" "user_admin" {
  server_name         = azurerm_postgresql_flexible_server.pg.name
  resource_group_name = var.resource_group_name
  tenant_id           = data.azurerm_client_config.current.tenant_id
  object_id           = var.aad_admin_object_id
  principal_name      = var.aad_admin_principal
  principal_type      = "User"
}

# Entra admin = the UAMI itself (so we can later promote it to grant intra-DB perms
# without keeping the human in the loop). Bootstrap script does CREATE ROLE for the UAMI.
resource "azurerm_postgresql_flexible_server_active_directory_administrator" "uami_admin" {
  server_name         = azurerm_postgresql_flexible_server.pg.name
  resource_group_name = var.resource_group_name
  tenant_id           = data.azurerm_client_config.current.tenant_id
  object_id           = var.uami_principal_id
  principal_name      = var.uami_name
  principal_type      = "ServicePrincipal"
}

resource "azurerm_postgresql_flexible_server_database" "pricing" {
  name      = "pricing"
  server_id = azurerm_postgresql_flexible_server.pg.id
  charset   = "UTF8"
  collation = "en_US.utf8"
}

resource "azurerm_postgresql_flexible_server_database" "orders" {
  name      = "orders"
  server_id = azurerm_postgresql_flexible_server.pg.id
  charset   = "UTF8"
  collation = "en_US.utf8"
}

resource "azurerm_postgresql_flexible_server_database" "inventory" {
  name      = "inventory"
  server_id = azurerm_postgresql_flexible_server.pg.id
  charset   = "UTF8"
  collation = "en_US.utf8"
}

output "id" { value = azurerm_postgresql_flexible_server.pg.id }
output "name" { value = azurerm_postgresql_flexible_server.pg.name }
output "fqdn" { value = azurerm_postgresql_flexible_server.pg.fqdn }
output "databases" { value = ["pricing", "orders", "inventory"] }
