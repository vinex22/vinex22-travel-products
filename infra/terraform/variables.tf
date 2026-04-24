variable "subscription_id" {
  description = "Azure subscription ID."
  type        = string
}

variable "project" {
  description = "Project short name. Used as the base of every resource name."
  type        = string
  default     = "vinex22"
  validation {
    condition     = can(regex("^[a-z][a-z0-9]{2,11}$", var.project))
    error_message = "project must be 3-12 chars, lowercase alphanumeric, starting with a letter."
  }
}

variable "owner_suffix" {
  description = "4-char lowercase alphanumeric suffix to make global names unique. Generate with scripts/init-names.sh."
  type        = string
  validation {
    condition     = can(regex("^[a-z0-9]{4}$", var.owner_suffix))
    error_message = "owner_suffix must be exactly 4 lowercase alphanumeric characters."
  }
}

variable "location" {
  description = "Azure region for all app + data resources."
  type        = string
  default     = "centralindia"
}

variable "current_user_object_id" {
  description = "Object ID of the signed-in user. Will be granted PG Entra admin and KV admin. Get with: az ad signed-in-user show --query id -o tsv"
  type        = string
}

variable "current_user_upn" {
  description = "UPN of the signed-in user. Used as the PG Flex AAD admin principal_name (must match the username at psql connect time). Get with: az ad signed-in-user show --query userPrincipalName -o tsv"
  type        = string
}

variable "tags" {
  description = "Common tags applied to every resource."
  type        = map(string)
  default = {
    project   = "vinex22-travels"
    purpose   = "sre-agent-demo"
    managedBy = "terraform"
  }
}

# ---- Per-resource toggles (sized for demo cost) ---------------------------

variable "aks_system_node_count" {
  description = "AKS system node pool count."
  type        = number
  default     = 2
}

variable "aks_user_node_min" {
  type    = number
  default = 3
}

variable "aks_user_node_max" {
  type    = number
  default = 6
}

variable "aks_authorized_ip_ranges" {
  description = "CIDRs allowed to reach the AKS API server. Defaults to 0.0.0.0/0 (Phase 0). Tighten in Phase 1."
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "kubernetes_namespace" {
  description = "Namespace used by all app workloads (federated SA subjects live here)."
  type        = string
  default     = "vinex22"
}

variable "service_account_names" {
  description = "Kubernetes ServiceAccount names that share the single UAMI via Workload Identity federation."
  type        = list(string)
  default     = ["pricing-sa", "checkout-sa", "inventory-sa", "cart-sa", "web-sa"]
}
