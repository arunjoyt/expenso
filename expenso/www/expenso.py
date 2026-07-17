import frappe

no_cache = 1


def get_context():
	context = frappe._dict()
	context.boot = get_boot()
	return context


def get_boot():
	return frappe._dict(
		{
			"site_name": frappe.local.site,
			"csrf_token": frappe.sessions.get_csrf_token(),
			"default_route": "/expenso",
		}
	)
