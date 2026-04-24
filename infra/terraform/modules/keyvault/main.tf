variable "resource_group_name" { type = string }
variable "location" { type = string }
variable "suffix" { type = string }
variable "tags" { type = map(string) }
variable "uami_principal_id" { type = string }
variable "current_user_object_id" { type = string }

data "azurerm_client_config" "current" {}

resource "azurerm_key_vault" "kv" {
  name                          = "kv-${var.suffix}"
  resource_group_name           = var.resource_group_name
  location                      = var.location
  tenant_id                     = data.azurerm_client_config.current.tenant_id
  sku_name                      = "standard"
  enable_rbac_authorization     = true # RBAC mode — no access policies (rbac_authorization_enabled in provider v5)
  purge_protection_enabled      = false
  soft_delete_retention_days    = 7
  public_network_access_enabled = true
  tags                          = var.tags
}

# UAMI reads secrets at runtime
resource "azurerm_role_assignment" "uami_secrets_user" {
  scope                = azurerm_key_vault.kv.id
  role_definition_name = "Key Vault Secrets User"
  principal_id         = var.uami_principal_id
}

# Signed-in user can manage secrets (so bootstrap scripts can put redis key etc.)
resource "azurerm_role_assignment" "user_secrets_officer" {
  scope                = azurerm_key_vault.kv.id
  role_definition_name = "Key Vault Secrets Officer"
  principal_id         = var.current_user_object_id
}

output "id" { value = azurerm_key_vault.kv.id }
output "name" { value = azurerm_key_vault.kv.name }
output "uri" { value = azurerm_key_vault.kv.vault_uri }
