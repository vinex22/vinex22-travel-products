variable "resource_group_name" { type = string }
variable "location" { type = string }
variable "suffix" { type = string }
variable "tags" { type = map(string) }

resource "azurerm_log_analytics_workspace" "law" {
  name                = "log-${var.suffix}"
  resource_group_name = var.resource_group_name
  location            = var.location
  sku                 = "PerGB2018"
  retention_in_days   = 30
  tags                = var.tags
}

resource "azurerm_application_insights" "ai" {
  name                = "ai-${var.suffix}"
  resource_group_name = var.resource_group_name
  location            = var.location
  workspace_id        = azurerm_log_analytics_workspace.law.id
  application_type    = "web"
  retention_in_days   = 30
  tags                = var.tags
}

output "law_id" { value = azurerm_log_analytics_workspace.law.id }
output "law_name" { value = azurerm_log_analytics_workspace.law.name }
output "appinsights_connection_string" {
  value     = azurerm_application_insights.ai.connection_string
  sensitive = true
}
output "appinsights_instrumentation_key" {
  value     = azurerm_application_insights.ai.instrumentation_key
  sensitive = true
}
