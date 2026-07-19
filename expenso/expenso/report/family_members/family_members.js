frappe.query_reports["Family Members"] = {
	filters: [
		{
			fieldname: "user",
			label: __("User"),
			fieldtype: "Link",
			options: "User",
			default: "",
		},
		{
			fieldname: "family",
			label: __("Family"),
			fieldtype: "Link",
			options: "Family",
			default: "",
		},
	],
};
