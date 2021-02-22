# Copyright 2016-2017 Tecnativa - Pedro M. Baeza
# Copyright 2017 Tecnativa - Carlos Dauden
# License AGPL-3.0 or later (http://www.gnu.org/licenses/agpl).

{
    "name": "Project Gantt",
    "summary": "Gantt view for projects",
    "version": "12.0.1.3.1",
    "category": "Project Management",
    "website": "https://github.com/OCA/project",
    "author": "Tecnativa, Onestein, "
              "Odoo Community Association (OCA)",
    "license": "AGPL-3",
    "installable": True,
    "depends": [
        "project",
        "hr_timesheet",
        "web_fgantt",
    ],
    "data":
        [
            "views/project_project_view.xml",
            "views/project_task_view.xml",
        ],
    "demo": []
}
