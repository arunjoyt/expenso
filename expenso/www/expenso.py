import frappe

import expenso

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
			"socketio_port": frappe.conf.socketio_port,
			"app_version": expenso.__version__,
			# Base URL of the expenso-assistant service; empty when unset, which
			# makes the Assistant tab show an "isn't configured" notice (P6-S6).
			"assistant_url": frappe.conf.get("expenso_assistant_url") or "",
		}
	)
