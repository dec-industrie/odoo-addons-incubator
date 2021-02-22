odoo.define('web_fgantt.GanttRenderer', function (require) {
    "use strict";

    var AbstractRenderer = require('web.AbstractRenderer');
    var core = require('web.core');
    var time = require('web.time');
    var utils = require('web.utils');
    var session = require('web.session');
    var QWeb = require('web.QWeb');
    var field_utils = require('web.field_utils');

    var _t = core._t;

    var GanttRenderer = AbstractRenderer.extend({
        template: "GanttView",

        events: _.extend({}, AbstractRenderer.prototype.events, {
            'click .oe_fgantt_button_scale_day_quarter': '_onScaleQuarterDayClicked',
            'click .oe_fgantt_button_scale_day_half': '_onScaleHalfDayClicked',
            'click .oe_fgantt_button_scale_day': '_onScaleDayClicked',
            'click .oe_fgantt_button_scale_week': '_onScaleWeekClicked',
            'click .oe_fgantt_button_scale_month': '_onScaleMonthClicked',
            'click .oe_fgantt_button_scale_year': '_onScaleYearClicked',
        }),

        /**
         * @constructor
         */
        init: function (parent, state, params) {
            this._super.apply(this, arguments);
            this.modelName = params.model;
            this.mode = params.mode;
            this.options = params.options;
            this.permissions = params.permissions;
            this.gantt = params.gantt;
            this.min_height = params.min_height;
            this.date_start = params.date_start;
            this.date_stop = params.date_stop;
            this.date_delay = params.date_delay;
            this.fieldNames = params.fieldNames;
            this.view = params.view;
            this.modelClass = this.view.model;
        },

        /**
         * @override
         */
        start: function () {
            var self = this;
            var attrs = this.arch.attrs;
            this.$el.addClass(attrs.class);
            this.$gantt = this.$el.find("#oe_fgantt_widget");

            if (!this.date_start) {
                throw new Error(_t("Gantt view has not defined 'date_start' attribute."));
            }
            this._super.apply(this, self);
        },

        /**
         * Triggered when the gantt is attached to the DOM.
         */
        on_attach_callback: function() {
            var height = this.$el.parent().height() - this.$el.find('.oe_fgantt_buttons').height();
            if (height > this.min_height) {
                // TODO: Add support for min-height in frappe-gantt or its container
            }
        },

        /**
         * @override
         */
        _render: function () {
            var self = this;
            return $.when().then(function () {
                // Prevent Double Rendering on Updates
                if (!self.gantt) {
                    self.init_gantt();
                    $(window).trigger('resize');
                }
            });
        },

        /**
         * Scale the gantt window to a quarter-day.
         *
         * @private
         */
        _onScaleQuarterDayClicked: function () {
            if (this.gantt) {
                this.gantt.change_view_mode('Quarter Day');
            }
        },

        /**
         * Scale the gantt window to a half-day.
         *
         * @private
         */
        _onScaleHalfDayClicked: function () {
            if (this.gantt) {
                this.gantt.change_view_mode('Half Day');
            }
        },

        /**
         * Scale the gantt window to a day.
         *
         * @private
         */
        _onScaleDayClicked: function () {
            if (this.gantt) {
                this.gantt.change_view_mode('Day');
            }
        },

        /**
         * Scale the gantt window to a week.
         *
         * @private
         */
        _onScaleWeekClicked: function () {
            if (this.gantt) {
                this.gantt.change_view_mode('Week');
            }
        },

        /**
         * Scale the gantt window to a month.
         *
         * @private
         */
        _onScaleMonthClicked: function () {
            if (this.gantt) {
                this.gantt.change_view_mode('Month');
            }
        },

        /**
         * Scale the gantt window to a year.
         *
         * @private
         */
        _onScaleYearClicked: function () {
            if (this.gantt) {
                this.gantt.change_view_mode('Year');
            }
        },

        /**
         * Initializes the gantt (https://frappe.io/gantt).
         *
         * @private
         */
        init_gantt: function () {
            var self = this;
            // TODO: Add editable support to frappe-gantt
            /*
            this.options.editable = {
                // add new items by double tapping
                add: this.modelClass.data.rights.create,
                // drag items horizontally
                updateTime: this.modelClass.data.rights.write,
                // drag items from one group to another
                updateGroup: this.modelClass.data.rights.write,
                // delete an item by tapping the delete button top right
                remove: this.modelClass.data.rights.unlink,
            };
            */
            $.extend(this.options, {
                custom_popup_html: function(task) {
                    self.custom_popup_html(task)
                },
                on_click: self.on_click,
                on_date_change: self.on_date_change,
                on_progress_change: self.on_progress_change,
                on_view_change: self.on_view_change,
            });
            this.qweb = new QWeb(session.debug, {_s: session.origin}, false);
            if (this.arch.children.length) {
                var tmpl = utils.json_node_to_xml(
                    _.filter(this.arch.children, function(item) {
                        return item.tag === 'templates';
                    })[0]
                );
                this.qweb.add_template(tmpl);
            }

            // F-Gantt needs task data at creation so we create a fake task
            // that will be replaced with real data later
            var dummy_tasks = [
                {
                    name: 'Loading Gantt Data',
                    start: new Date(today.getFullYear(), today.getMonth(), today.getDate()),
                    end: new Date(today.getFullYear(), today.getMonth(), today.getDate()+7),
                    progress: 100,
                },
            ]
            this.gantt = new Gantt(self.$gantt.empty().get(0), dummy_tasks, this.options);

            // TODO: Add group support to frappe-gantt
            var group_bys = this.arch.attrs.default_group_by.split(',');
            this.last_group_bys = group_bys;
            this.last_domains = this.modelClass.data.domain;
            this.on_data_loaded(this.modelClass.data.records, group_bys);
        },

        /**
         * Load display_name of records.
         *
         * @private
         * @returns {jQuery.Deferred}
         */
        on_data_loaded: function (records, group_bys) {
            var self = this;
            var ids = _.pluck(records, "id");
            return this._rpc({
                model: this.modelName,
                method: 'name_get',
                args: [
                    ids,
                ],
                context: this.getSession().user_context,
            }).then(function(names) {
                var nrecords = _.map(records, function (record) {
                    return _.extend({
                        __name: _.detect(names, function (name) {
                            return name[0] === record.id;
                        })[1]
                    }, record);
                });
                return self.on_data_loaded_2(nrecords, group_bys);
            });
        },

        /**
         * Set groups and records.
         *
         * @private
         */
        on_data_loaded_2: function (records, group_bys) {
            var self = this;
            var tasks = [];
            this.grouped_by = group_bys;
            _.each(records, function (record) {
                if (record[self.date_start]) {
                    tasks.push(self.record_data_transform(record));
                }
            });

            this.gantt.refresh(tasks);
            // TODO: Add group support to frappe-gantt
            /*
            var groups = this.split_groups(records, group_bys);
            this.gantt.refresh_groups(groups);
            */
        },

        /**
         * Get the groups.
         * TODO: Add group support to frappe-gantt
         *
         * @private
         * @returns {Array}
         */
        split_groups: function (records, group_bys) {
            if (group_bys.length === 0) {
                return records;
            }
            var groups = [];
            groups.push({id: -1, content: _t('-')});
            _.each(records, function (record) {
                var group_name = record[_.first(group_bys)];
                if (group_name) {
                    if (group_name instanceof Array) {
                        var group = _.find(groups, function (existing_group) {
                            return _.isEqual(existing_group.id, group_name[0]);
                        });

                        if (_.isUndefined(group)) {
                            group = {
                                id: group_name[0],
                                content: group_name[1]
                            };
                            groups.push(group);
                        }
                    }
                }
            });
            return groups;
        },

        /**
         * Transform Odoo record object to gantt task object.
         *
         * @private
         * @returns {Object}
         */
        record_data_transform: function (record) {
            var self = this;
            var date_start = new moment();
            var date_stop = null;

            var date_delay = record[this.date_delay] || false,
                all_day = this.all_day ? record[this.all_day] : false;

            if (all_day) {
                date_start = time.auto_str_to_date(record[this.date_start].split(' ')[0], 'start');
                if (this.no_period) {
                    date_stop = date_start;
                } else {
                    date_stop = this.date_stop ? time.auto_str_to_date(record[this.date_stop].split(' ')[0], 'stop') : null;
                }
            } else {
                date_start = time.auto_str_to_date(record[this.date_start]);
                date_stop = this.date_stop ? time.auto_str_to_date(record[this.date_stop]) : null;
            }

            if (!date_stop && date_delay) {
                date_stop = moment(date_start).add(date_delay, 'hours').toDate();
            }

            // TODO: Add group support to frappe-gantt
            var group = record[self.last_group_bys[0]];
            if (group && group instanceof Array) {
                group = _.first(group);
            } else {
                group = -1;
            }

            var content = _.isUndefined(record.__name) ? record.display_name : record.__name;

            var r = {
                'record': record,
                'group': group,
                'start': date_start,
                'end': date_stop,
                'name': content,
                'progress': 0,
            };
            return r;
        },

        /**
         * Render f-gantt item template.
         *
         * @param {Object} record Record
         * @private
         * @returns {String} Rendered template
         */
        render_fgantt_item: function (record) {
            if(this.qweb.has_template('fgantt-item')) {
                return this.qweb.render('fgantt-item', {
                    'record': record,
                    'field_utils': field_utils
                });
            }

            console.error(
                _t('Template "fgantt-item" not present in gantt view definition.')
            );
        },

        /**
         * Render task html popup content.
         *
         * @param {Object} task Task
         * @private
         * @returns {String} Html
         */
        custom_popup_html: function (task) {
            var self = this;
            content = null;
            if (self.arch.children.length) {
                content = self.render_fgantt_item(task.record);
            }
            return content
        },

        /**
         * Trigger onClick.
         *
         * @private
         */
        on_click: function (task) {
            console.log(task);
        },

        /**
         * Trigger onDateChange.
         *
         * @private
         */
        on_date_change: function (task, start, end) {
            console.log(task, start, end);
            this.trigger_up('onDateChange', {
                'task': task,
                'start': start,
                'end': end,
                'rights': this.modelClass.data.rights,
                'renderer': this,
                callback: function (task) {
                    console.log('Fake callback', task);
                },
            });
        },

        /**
         * Trigger onProgressChange.
         *
         * @private
         */
        on_progress_change: function (task, progress) {
            console.log(task, progress);
        },

        /**
         * Trigger onViewChange.
         *
         * @private
         */
        on_view_change: function (mode) {
            console.log(mode);
        },

    });

    return GanttRenderer;
});
