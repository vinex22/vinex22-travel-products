variable "resource_group_name" { type = string }
variable "location" { type = string }
variable "suffix" { type = string }
variable "tags" { type = map(string) }
variable "oidc_issuer_url" { type = string }
variable "kubernetes_namespace" { type = string }
variable "service_account_names" { type = list(string) }

# Single user-assigned managed identity, federated to multiple K8s ServiceAccounts
# via Workload Identity. All app services authenticate to PG, Redis, Storage, KV,
# Service Bus through this identity (no SAS, no keys, no connection strings).
resource "azurerm_user_assigned_identity" "uami" {
  name                = "id-${var.suffix}"
  resource_group_name = var.resource_group_name
  location            = var.location
  tags                = var.tags
}

resource "azurerm_federated_identity_credential" "fic" {
  for_each            = toset(var.service_account_names)
  name                = "fic-${each.key}"
  resource_group_name = var.resource_group_name
  parent_id           = azurerm_user_assigned_identity.uami.id
  audience            = ["api://AzureADTokenExchange"]
  issuer              = var.oidc_issuer_url
  subject             = "system:serviceaccount:${var.kubernetes_namespace}:${each.key}"
}

output "uami_id" { value = azurerm_user_assigned_identity.uami.id }
output "uami_name" { value = azurerm_user_assigned_identity.uami.name }
output "uami_client_id" { value = azurerm_user_assigned_identity.uami.client_id }
output "uami_principal_id" { value = azurerm_user_assigned_identity.uami.principal_id }
output "uami_tenant_id" { value = azurerm_user_assigned_identity.uami.tenant_id }
