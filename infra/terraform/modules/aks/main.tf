variable "resource_group_name" { type = string }
variable "location" { type = string }
variable "suffix" { type = string }
variable "tags" { type = map(string) }
variable "system_node_count" { type = number }
variable "user_node_min" { type = number }
variable "user_node_max" { type = number }
variable "authorized_ip_ranges" { type = list(string) }
variable "log_analytics_workspace_id" { type = string }

resource "azurerm_kubernetes_cluster" "aks" {
  name                = "aks-${var.suffix}"
  resource_group_name = var.resource_group_name
  location            = var.location
  dns_prefix          = "aks-${var.suffix}"
  sku_tier            = "Standard"
  node_resource_group = "rg-${var.suffix}-aks-nodes"

  # Always-public API server with authorized IP ranges (Phase 0: 0.0.0.0/0)
  api_server_access_profile {
    authorized_ip_ranges = var.authorized_ip_ranges
  }

  # Workload Identity + OIDC required for the single UAMI federation pattern
  oidc_issuer_enabled       = true
  workload_identity_enabled = true

  # Azure CNI Overlay
  network_profile {
    network_plugin      = "azure"
    network_plugin_mode = "overlay"
    network_policy      = "azure"
    pod_cidr            = "10.244.0.0/16"
    service_cidr        = "10.0.0.0/16"
    dns_service_ip      = "10.0.0.10"
    load_balancer_sku   = "standard"
  }

  identity {
    type = "SystemAssigned"
  }

  default_node_pool {
    name                         = "system"
    vm_size                      = "Standard_D2s_v5"
    node_count                   = var.system_node_count
    only_critical_addons_enabled = true
    upgrade_settings {
      max_surge = "10%"
    }
  }

  # Container Insights add-on
  oms_agent {
    log_analytics_workspace_id      = var.log_analytics_workspace_id
    msi_auth_for_monitoring_enabled = true
  }

  # Managed Prometheus add-on
  monitor_metrics {}

  azure_policy_enabled = false

  tags = var.tags
}

# User node pool for app workloads
resource "azurerm_kubernetes_cluster_node_pool" "user" {
  name                  = "user"
  kubernetes_cluster_id = azurerm_kubernetes_cluster.aks.id
  vm_size               = "Standard_D4s_v5"
  auto_scaling_enabled  = true
  min_count             = var.user_node_min
  max_count             = var.user_node_max
  mode                  = "User"
  os_disk_size_gb       = 64

  # Match the helm chart's nodeSelector (pool=user). AKS exposes the pool name
  # under agentpool=user / kubernetes.azure.com/mode=user, but the chart was
  # written against a custom 'pool' label, so we publish that explicitly.
  node_labels = {
    pool = "user"
  }

  upgrade_settings {
    max_surge = "33%"
  }

  tags = var.tags
}

output "id" { value = azurerm_kubernetes_cluster.aks.id }
output "name" { value = azurerm_kubernetes_cluster.aks.name }
output "oidc_issuer_url" { value = azurerm_kubernetes_cluster.aks.oidc_issuer_url }
output "kubelet_identity_object_id" { value = azurerm_kubernetes_cluster.aks.kubelet_identity[0].object_id }
