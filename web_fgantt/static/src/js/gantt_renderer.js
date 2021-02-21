odoo.define('web_fgantt.GanttRenderer', function (require) {
    "use strict";

    var AbstractRenderer = require('web.AbstractRenderer');
    var core = require('web.core');
    var time = require('web.time');
    var utils = require('web.utils');
    var session = require('web.session');
    var QWeb = require('web.QWeb');
    var field_utils = require('web.field_utils');
    // var GanttCanvas = require('web_fgantt.GanttCanvas');

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
            this.colors = params.colors;
            this.fieldNames = params.fieldNames;
            this.dependency_arrow = params.dependency_arrow;
            this.view = params.view;
            this.modelClass = this.view.model;
        },

        /**
         * @override
         */
        start: function () {
            var self = this;
            var attrs = this.arch.attrs;
            this.current_window = {
                start: new moment(),
                end: new moment().add(24, 'hours')
            };

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

                // this.gantt.setOptions({
                //     height: height
                // });
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
         * Computes the initial visible window.
         *
         * @private
         */
        _computeMode: function () {
            if (this.mode) {
                var start = false, end = false;
                switch (this.mode) {
                    case 'day':
                        start = new moment().startOf('day');
                        end = new moment().endOf('day');
                        break;
                    case 'week':
                        start = new moment().startOf('week');
                        end = new moment().endOf('week');
                        break;
                    case 'month':
                        start = new moment().startOf('month');
                        end = new moment().endOf('month');
                        break;
                }
                if (end && start) {
                    this.options.start = start;
                    this.options.end = end;
                } else {
                   this.mode = 'fit';
                }
            }
        },

        /**
         * Initializes the gantt (https://frappe.io/gantt).
         *
         * @private
         */
        init_gantt: function () {
            var self = this;
            this._computeMode();
            // this.options.editable = {
            //     // add new items by double tapping
            //     add: this.modelClass.data.rights.create,
            //     // drag items horizontally
            //     updateTime: this.modelClass.data.rights.write,
            //     // drag items from one group to another
            //     updateGroup: this.modelClass.data.rights.write,
            //     // delete an item by tapping the delete button top right
            //     remove: this.modelClass.data.rights.unlink,
            // };
            $.extend(this.options, {
                // onAdd: self.on_add,
                // onMove: self.on_move,
                // onUpdate: self.on_update,
                // onRemove: self.on_remove
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

            var tasks = [
                {
                    id: 'Task 1',
                    name: 'Redesign website',
                    start: '2016-12-28',
                    end: '2016-12-31',
                    progress: 20,
                },
            ]

            this.gantt = new Gantt(self.$gantt.empty().get(0), tasks, this.options);

            // this.gantt = new vis.Timeline(self.$gantt.empty().get(0));
            // this.gantt.setOptions(this.options);
            // if (self.mode && self['on_scale_' + self.mode + '_clicked']) {
            //     self['on_scale_' + self.mode + '_clicked']();
            // }
            // this.gantt.on('click', self.on_group_click);
            var group_bys = this.arch.attrs.default_group_by.split(',');
            this.last_group_bys = group_bys;
            this.last_domains = this.modelClass.data.domain;
            this.on_data_loaded(this.modelClass.data.data, group_bys);
            // this.$centerContainer = $(this.gantt.dom.centerContainer);
            // this.canvas = new GanttCanvas(this);
            // this.canvas.appendTo(this.$centerContainer);
            // this.gantt.on('changed', function() {
            //     self.draw_canvas();
            //     self.canvas.$el.attr(
            //         'style',
            //         self.$el.find('.vis-content').attr('style') + self.$el.find('.vis-itemset').attr('style')
            //     );
            // });
        },

        // /**
        //  * Clears and draws the canvas items.
        //  *
        //  * @private
        //  */
        // draw_canvas: function () {
        //     this.canvas.clear();
        //     if (this.dependency_arrow) {
        //         this.draw_dependencies();
        //     }
        // },

        // /**
        //  * Draw item dependencies on canvas.
        //  *
        //  * @private
        //  */
        // draw_dependencies: function () {
        //     var self = this;
        //     var items = this.gantt.itemSet.items;
        //     _.each(items, function(item) {
        //         if (!item.data.evt) {
        //             return;
        //         }
        //         _.each(item.data.evt[self.dependency_arrow], function(id) {
        //             if (id in items) {
        //                 self.draw_dependency(item, items[id]);
        //             }
        //         });
        //     });
        // },

        // /**
        //  * Draws a dependency arrow between 2 gantt items.
        //  *
        //  * @param {Object} from Start gantt item
        //  * @param {Object} to Destination gantt item
        //  * @param {Object} options
        //  * @param {Object} options.line_color Color of the line
        //  * @param {Object} options.line_width The width of the line
        //  * @private
        //  */
        // draw_dependency: function (from, to, options) {
        //     if (!from.displayed || !to.displayed) {
        //         return;
        //     }

        //     var defaults = _.defaults({}, options, {
        //         line_color: 'black',
        //         line_width: 1
        //     });

        //     this.canvas.draw_arrow(from.dom.box, to.dom.box, defaults.line_color, defaults.line_width);
        // },

        /**
         * Load display_name of records.
         *
         * @private
         * @returns {jQuery.Deferred}
         */
        on_data_loaded: function (events, group_bys, adjust_window) {
            var self = this;
            var ids = _.pluck(events, "id");
            return this._rpc({
                model: this.modelName,
                method: 'name_get',
                args: [
                    ids,
                ],
                context: this.getSession().user_context,
            }).then(function(names) {
                var nevents = _.map(events, function (event) {
                    return _.extend({
                        __name: _.detect(names, function (name) {
                            return name[0] === event.id;
                        })[1]
                    }, event);
                });
                return self.on_data_loaded_2(nevents, group_bys, adjust_window);
            });
        },

        /**
         * Set groups and events.
         *
         * @private
         */
        on_data_loaded_2: function (events, group_bys, adjust_window) {
            var self = this;
            var data = [];
            var groups = [];
            this.grouped_by = group_bys;
            _.each(events, function (event) {
                if (event[self.date_start]) {
                    data.push(self.event_data_transform(event));
                }
            });
            groups = this.split_groups(events, group_bys);

            this.gantt.refresh(data);
            // Was for timeline
            // this.gantt.setGroups(groups);
            // this.gantt.setItems(data);
            // var mode = !this.mode || this.mode === 'fit';
            // var adjust = _.isUndefined(adjust_window) || adjust_window;
            // if (mode && adjust) {
            //     this.gantt.fit();
            // }
        },

        /**
         * Get the groups.
         *
         * @private
         * @returns {Array}
         */
        split_groups: function (events, group_bys) {
            if (group_bys.length === 0) {
                return events;
            }
            var groups = [];
            groups.push({id: -1, content: _t('-')});
            _.each(events, function (event) {
                var group_name = event[_.first(group_bys)];
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
         * Transform Odoo event object to gantt event object.
         *
         * @private
         * @returns {Object}
         */
        event_data_transform: function (evt) {
            // var self = this;
            var date_start = new moment();
            var date_stop = null;

            var date_delay = evt[this.date_delay] || false,
                all_day = this.all_day ? evt[this.all_day] : false;

            if (all_day) {
                date_start = time.auto_str_to_date(evt[this.date_start].split(' ')[0], 'start');
                if (this.no_period) {
                    date_stop = date_start;
                } else {
                    date_stop = this.date_stop ? time.auto_str_to_date(evt[this.date_stop].split(' ')[0], 'stop') : null;
                }
            } else {
                date_start = time.auto_str_to_date(evt[this.date_start]);
                date_stop = this.date_stop ? time.auto_str_to_date(evt[this.date_stop]) : null;
            }

            // if (!date_stop && date_delay) {
            //     date_stop = moment(date_start).add(date_delay, 'hours').toDate();
            // }

            // var group = evt[self.last_group_bys[0]];
            // if (group && group instanceof Array) {
            //     group = _.first(group);
            // } else {
            //     group = -1;
            // }
            // _.each(self.colors, function (color) {
            //     if (eval("'" + evt[color.field] + "' " + color.opt + " '" + color.value + "'")) {
            //         self.color = color.color;
            //     }
            // });

            var content = _.isUndefined(evt.__name) ? evt.display_name : evt.__name;
            if (this.arch.children.length) {
                content = this.render_gantt_item(evt);
            }

            // var r = {
            //     'start': date_start,
            //     'content': content,
            //     'id': evt.id,
            //     'group': group,
            //     'evt': evt,
            //     'style': 'background-color: ' + self.color + ';'
            // };
            // // Check if the event is instantaneous, if so, display it with a point on the gantt (no 'end')
            // if (date_stop && !moment(date_start).isSame(date_stop)) {
            //     r.end = date_stop;
            // }
            // self.color = null;
            var r = {
                'odoo_id': evt.id,
                'start': date_start,
                'end': date_stop,
                'name': content,
                'progress': 0,
            };
            return r;
        },

        /**
         * Render gantt item template.
         *
         * @param {Object} evt Record
         * @private
         * @returns {String} Rendered template
         */
        render_gantt_item: function (evt) {
            if(this.qweb.has_template('gantt-item')) {
                return this.qweb.render('gantt-item', {
                    'record': evt,
                    'field_utils': field_utils
                });
            }

            console.error(
                _t('Template "gantt-item" not present in gantt view definition.')
            );
        },

        on_click: function (task) {
            console.log(task);
        },

        on_date_change: function (task, start, end) {
            console.log(task, start, end);
        },

        on_progress_change: function (task, progress) {
            console.log(task, progress);
        },

        on_view_change: function (mode) {
            console.log(mode);
        },

        // /**
        //  * Handle a click on a group header.
        //  *
        //  * @private
        //  */
        // on_group_click: function (e) {
        //     if (e.what === 'group-label' && e.group !== -1) {
        //         this._trigger(e, function() {
        //             // Do nothing
        //         }, 'onGroupClick');
        //     }
        // },

        // /**
        //  * Trigger onUpdate.
        //  *
        //  * @private
        //  */
        // on_update: function (item, callback) {
        //     this._trigger(item, callback, 'onUpdate');
        // },

        // /**
        //  * Trigger onMove.
        //  *
        //  * @private
        //  */
        // on_move: function (item, callback) {
        //     this._trigger(item, callback, 'onMove');
        // },

        // /**
        //  * Trigger onRemove.
        //  *
        //  * @private
        //  */
        // on_remove: function (item, callback) {
        //     this._trigger(item, callback, 'onRemove');
        // },

        // /**
        //  * Trigger onAdd.
        //  *
        //  * @private
        //  */
        // on_add: function (item, callback) {
        //     this._trigger(item, callback, 'onAdd');
        // },

        /**
         * trigger_up encapsulation adds by default the rights, and the renderer.
         *
         * @private
         */
        _trigger: function (item, callback, trigger) {
            this.trigger_up(trigger, {
                'item': item,
                'callback': callback,
                'rights': this.modelClass.data.rights,
                'renderer': this,
            });
        },

    });

    return GanttRenderer;
});
