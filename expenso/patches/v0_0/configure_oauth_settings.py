import frappe


def execute():
	"""Enable the OAuth2 discovery metadata the MCP connector's auth-spec
	compliance depends on (RFC 8414 + RFC 9728, see ADR 0005), and turn off
	Dynamic Client Registration since Expenso only ever uses one
	admin-pre-registered `OAuth Client`, not self-service registration.

	Also advertises expenso:read in Scopes Supported so a spec-compliant
	client can discover it. Safe to re-run.
	"""
	frappe.db.set_single_value(
		"OAuth Settings",
		{
			"show_auth_server_metadata": 1,
			"show_protected_resource_metadata": 1,
			"enable_dynamic_client_registration": 0,
		},
	)

	scopes_supported = frappe.db.get_single_value("OAuth Settings", "scopes_supported") or ""
	scopes = {scope for scope in scopes_supported.splitlines() if scope}
	scopes.add("expenso:read")
	frappe.db.set_single_value("OAuth Settings", "scopes_supported", "\n".join(sorted(scopes)))
