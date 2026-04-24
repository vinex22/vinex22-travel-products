locals {
  # Common naming helpers
  suffix = "${var.project}-${var.owner_suffix}" # vinex22-abcd
  flat   = "${var.project}${var.owner_suffix}"  # vinex22abcd  (for storage/acr where dashes not allowed)
  rg     = "rg-${local.suffix}"
}

# ---- Resource group --------------------------------------------------------

resource "azurerm_resource_group" "main" {
  name     = local.rg
  location = var.location
  tags     = var.tags
}

# ---- Modules ---------------------------------------------------------------

module "observability" {
  source              = "./modules/observability"
  resource_group_name = azurerm_resource_group.main.name
  location            = var.location
  suffix              = local.suffix
  tags                = var.tags
}

module "identity" {
  source              = "./modules/identity"
  resource_group_name = azurerm_resource_group.main.name
  location            = var.location
  suffix              = local.suffix
  tags                = var.tags

  oidc_issuer_url       = module.aks.oidc_issuer_url
  kubernetes_namespace  = var.kubernetes_namespace
  service_account_names = var.service_account_names
}

module "network" {
  source              = "./modules/network"
  resource_group_name = azurerm_resource_group.main.name
  location            = var.location
  suffix              = local.suffix
  tags                = var.tags
}

module "acr" {
  source              = "./modules/acr"
  resource_group_name = azurerm_resource_group.main.name
  location            = var.location
  flat                = local.flat
  tags                = var.tags

  kubelet_principal_id = module.aks.kubelet_identity_object_id
}

module "aks" {
  source              = "./modules/aks"
  resource_group_name = azurerm_resource_group.main.name
  location            = var.location
  suffix              = local.suffix
  tags                = var.tags

  system_node_count          = var.aks_system_node_count
  user_node_min              = var.aks_user_node_min
  user_node_max              = var.aks_user_node_max
  authorized_ip_ranges       = var.aks_authorized_ip_ranges
  log_analytics_workspace_id = module.observability.law_id
}

module "postgres" {
  source              = "./modules/postgres"
  resource_group_name = azurerm_resource_group.main.name
  location            = var.location
  suffix              = local.suffix
  tags                = var.tags

  aad_admin_object_id = var.current_user_object_id
  aad_admin_principal = var.current_user_upn
  uami_principal_id   = module.identity.uami_principal_id
  uami_client_id      = module.identity.uami_client_id
  uami_name           = module.identity.uami_name
}

module "servicebus" {
  source              = "./modules/servicebus"
  resource_group_name = azurerm_resource_group.main.name
  location            = var.location
  suffix              = local.suffix
  tags                = var.tags

  uami_principal_id = module.identity.uami_principal_id
}

module "redis" {
  source              = "./modules/redis"
  resource_group_name = azurerm_resource_group.main.name
  location            = var.location
  suffix              = local.suffix
  tags                = var.tags
}

module "storage" {
  source              = "./modules/storage"
  resource_group_name = azurerm_resource_group.main.name
  location            = var.location
  flat                = local.flat
  tags                = var.tags

  uami_principal_id      = module.identity.uami_principal_id
  current_user_object_id = var.current_user_object_id
}

module "keyvault" {
  source              = "./modules/keyvault"
  resource_group_name = azurerm_resource_group.main.name
  location            = var.location
  suffix              = local.suffix
  tags                = var.tags

  uami_principal_id      = module.identity.uami_principal_id
  current_user_object_id = var.current_user_object_id
}
