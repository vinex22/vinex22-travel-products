variable "resource_group_name" { type = string }
variable "location" { type = string }
variable "suffix" { type = string }
variable "tags" { type = map(string) }
variable "uami_principal_id" { type = string }

resource "azurerm_servicebus_namespace" "sb" {
  name                = "sb-${var.suffix}"
  resource_group_name = var.resource_group_name
  location            = var.location
  sku                 = "Standard"
  local_auth_enabled  = false # Entra-only — no SAS keys
  tags                = var.tags
}

resource "azurerm_servicebus_topic" "orders" {
  name         = "orders"
  namespace_id = azurerm_servicebus_namespace.sb.id
}

resource "azurerm_servicebus_subscription" "inventory" {
  name               = "inventory"
  topic_id           = azurerm_servicebus_topic.orders.id
  max_delivery_count = 10
}

# UAMI permissions: send (checkout-service) + receive (inventory-service).
# Granting both at namespace scope keeps the model simple for the demo.
resource "azurerm_role_assignment" "sb_sender" {
  scope                = azurerm_servicebus_namespace.sb.id
  role_definition_name = "Azure Service Bus Data Sender"
  principal_id         = var.uami_principal_id
}

resource "azurerm_role_assignment" "sb_receiver" {
  scope                = azurerm_servicebus_namespace.sb.id
  role_definition_name = "Azure Service Bus Data Receiver"
  principal_id         = var.uami_principal_id
}

output "namespace_id" { value = azurerm_servicebus_namespace.sb.id }
output "namespace_name" { value = azurerm_servicebus_namespace.sb.name }
output "topic_name" { value = azurerm_servicebus_topic.orders.name }
