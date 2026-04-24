variable "resource_group_name" { type = string }
variable "location" { type = string }
variable "suffix" { type = string }
variable "tags" { type = map(string) }

# Reserved for Phase 1 private endpoints. In Phase 0 (Day-0 demo) all PaaS
# services are public; we keep this VNet provisioned so toggling to private
# endpoints later is non-destructive.
resource "azurerm_virtual_network" "vnet" {
  name                = "vnet-${var.suffix}"
  resource_group_name = var.resource_group_name
  location            = var.location
  address_space       = ["10.40.0.0/16"]
  tags                = var.tags
}

resource "azurerm_subnet" "pe" {
  name                              = "snet-pe"
  resource_group_name               = var.resource_group_name
  virtual_network_name              = azurerm_virtual_network.vnet.name
  address_prefixes                  = ["10.40.10.0/24"]
  private_endpoint_network_policies = "Disabled"
}

output "vnet_id" { value = azurerm_virtual_network.vnet.id }
output "vnet_name" { value = azurerm_virtual_network.vnet.name }
output "pe_subnet_id" { value = azurerm_subnet.pe.id }
