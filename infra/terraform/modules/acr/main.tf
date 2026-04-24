variable "resource_group_name" { type = string }
variable "location" { type = string }
variable "flat" { type = string } # vinex22abcd (no dashes — ACR name rules)
variable "tags" { type = map(string) }
variable "kubelet_principal_id" { type = string }

resource "azurerm_container_registry" "acr" {
  name                          = "acr${var.flat}"
  resource_group_name           = var.resource_group_name
  location                      = var.location
  sku                           = "Basic"
  admin_enabled                 = false # No admin keys — repo policy
  public_network_access_enabled = true  # Phase 0
  tags                          = var.tags
}

# AKS kubelet identity → AcrPull
resource "azurerm_role_assignment" "aks_acrpull" {
  scope                = azurerm_container_registry.acr.id
  role_definition_name = "AcrPull"
  principal_id         = var.kubelet_principal_id
}

output "id" { value = azurerm_container_registry.acr.id }
output "name" { value = azurerm_container_registry.acr.name }
output "login_server" { value = azurerm_container_registry.acr.login_server }
