/* Odoo web_fgantt
 * Copyright 2015 ACSONE SA/NV
 * Copyright 2016 Pedro M. Baeza <pedro.baeza@tecnativa.com>
 * License AGPL-3.0 or later (http://www.gnu.org/licenses/agpl). */

_.str.toBoolElse = function (str, elseValues, trueValues, falseValues) {
    var ret = _.str.toBool(str, trueValues, falseValues);
    if (_.isUndefined(ret)) {
        return elseValues;
    }
    return ret;
};


odoo.define('web_fgantt.GanttView', function (require) {
    "use strict";

    var core = require('web.core');
    var view_registry = require('web.view_registry');
    var AbstractView = require('web.AbstractView');
    var GanttRenderer = require('web_fgantt.GanttRenderer');
    var GanttController = require('web_fgantt.GanttController');
    var GanttModel = require('web_fgantt.GanttModel');

    var _lt = core._lt;

    function isNullOrUndef(value) {
        return _.isUndefined(value) || _.isNull(value);
    }

    var GanttView = AbstractView.extend({
        display_name: _lt('Gantt'),
        icon: 'fa-tasks',
        jsLibs: [
            '/web/static/lib/moment/moment.js',
            '/web_fgantt/static/lib/snap/snap.svg.js',
            '/web_fgantt/static/lib/frappe/frappe-gantt.js',
        ],
        cssLibs: ['/web_fgantt/static/lib/frappe/frappe-gantt.css'],
        config: {
            Model: GanttModel,
            Controller: GanttController,
            Renderer: GanttRenderer,
        },

        /**
         * @constructor
         * @override
         */
        init: function (viewInfo, params) {
            this._super.apply(this, arguments);
            var self = this;
            this.gantt = false;
            this.arch = this.rendererParams.arch;
            var attrs = this.arch.attrs;
            this.fields = viewInfo.fields;
            this.modelName = this.controllerParams.modelName;
            this.action = params.action;

            var fieldNames = this.fields.display_name ? ['display_name'] : [];
            var mapping = {};
            var fieldsToGather = [
                "date_start",
                "date_stop",
                "default_group_by",
                "progress",
                "date_delay",
            ];

            fieldsToGather.push(attrs.default_group_by);

            _.each(fieldsToGather, function (field) {
                if (attrs[field]) {
                    var fieldName = attrs[field];
                    mapping[field] = fieldName;
                    fieldNames.push(fieldName);
                }
            });

            var archFieldNames = _.map(_.filter(this.arch.children, function(item) {
                return item.tag === 'field';
            }), function(item) {
                return item.attrs.name;
            });
            fieldNames = _.union(
                fieldNames,
                archFieldNames
            );

            this.permissions = {};
            this.grouped_by = false;
            this.date_start = attrs.date_start;
            this.date_stop = attrs.date_stop;
            this.date_delay = attrs.date_delay;
            this.progress = attrs.progress;

            this.no_period = this.date_start === this.date_stop;
            this.mode = attrs.mode || attrs.default_window || 'fit';
            this.min_height = attrs.min_height || 300;

            if (!isNullOrUndef(attrs.quick_create_instance)) {
                self.quick_create_instance = 'instance.' + attrs.quick_create_instance;
            }

            this.options = {
                groupOrder: this.group_order,
            };
            if (isNullOrUndef(attrs.event_open_popup) || !_.str.toBoolElse(attrs.event_open_popup, true)) {
                this.open_popup_action = false;
            } else {
                this.open_popup_action = attrs.event_open_popup;
            }

            this.rendererParams.mode = this.mode;
            this.rendererParams.model = this.modelName;
            this.rendererParams.options = this.options;
            this.rendererParams.permissions = this.permissions;
            this.rendererParams.gantt = this.gantt;
            this.rendererParams.date_start = this.date_start;
            this.rendererParams.date_stop = this.date_stop;
            this.rendererParams.date_delay = this.date_delay;
            this.rendererParams.progress = this.progress;
            this.rendererParams.fieldNames = fieldNames;
            this.rendererParams.view = this;
            this.rendererParams.min_height = this.min_height;

            this.loadParams.modelName = this.modelName;
            this.loadParams.fieldNames = fieldNames;

            this.controllerParams.open_popup_action = this.open_popup_action;
            this.controllerParams.date_start = this.date_start;
            this.controllerParams.date_stop = this.date_stop;
            this.controllerParams.date_delay = this.date_delay;
            this.controllerParams.actionContext = this.action.context;

            return this;
        },

        /**
         * Order function for groups.
         */
        group_order: function (grp1, grp2) {
            // display non grouped elements first
            if (grp1.id === -1) {
                return -1;
            }
            if (grp2.id === -1) {
                return +1;
            }
            return grp1.content.localeCompare(grp2.content);
        },

    });

    view_registry.add('fgantt', GanttView);
    return GanttView;
});
