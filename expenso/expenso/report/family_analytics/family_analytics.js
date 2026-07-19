frappe.query_reports["Family Analytics"] = {
	filters: [
		{
			fieldname: "family",
			label: __("Family"),
			fieldtype: "Link",
			options: "Family",
			reqd: 1,
		},
		{
			fieldname: "month",
			label: __("Month"),
			fieldtype: "Select",
			options: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].join("\n"),
			default: String(frappe.datetime.now_date().split("-")[1]).replace(/^0/, ""),
			reqd: 1,
		},
		{
			fieldname: "year",
			label: __("Year"),
			fieldtype: "Int",
			default: frappe.datetime.now_date().split("-")[0],
			reqd: 1,
		},
	],
};
