variable "resource_group_name" { type = string }
variable "location" { type = string }
variable "flat" { type = string }
variable "tags" { type = map(string) }
variable "uami_principal_id" { type = string }
variable "current_user_object_id" { type = string }

resource "azurerm_storage_account" "sa" {
  name                     = "st${var.flat}"
  resource_group_name      = var.resource_group_name
  location                 = var.location
  account_tier             = "Standard"
  account_replication_type = "LRS"
  account_kind             = "StorageV2"

  shared_access_key_enabled       = false # NO SAS, NO keys — repo policy
  default_to_oauth_authentication = true
  https_traffic_only_enabled      = true
  min_tls_version                 = "TLS1_2"

  public_network_access_enabled   = true
  allow_nested_items_to_be_public = false

  tags = var.tags
}

resource "azurerm_storage_container" "images" {
  name                  = "images"
  storage_account_id    = azurerm_storage_account.sa.id
  container_access_type = "private"
}

# UAMI: Storage Blob Data Contributor (web-cloud reads/writes blobs)
resource "azurerm_role_assignment" "uami_blob" {
  scope                = azurerm_storage_account.sa.id
  role_definition_name = "Storage Blob Data Contributor"
  principal_id         = var.uami_principal_id
}

# Signed-in user: same role so seed-images.py works from your laptop
resource "azurerm_role_assignment" "user_blob" {
  scope                = azurerm_storage_account.sa.id
  role_definition_name = "Storage Blob Data Contributor"
  principal_id         = var.current_user_object_id
}

output "id" { value = azurerm_storage_account.sa.id }
output "account_name" { value = azurerm_storage_account.sa.name }
output "blob_endpoint" { value = azurerm_storage_account.sa.primary_blob_endpoint }
output "images_container" { value = azurerm_storage_container.images.name }
