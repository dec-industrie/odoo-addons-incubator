odoo.define('web_fgantt.GanttController', function (require) {
    "use strict";

    var AbstractController = require('web.AbstractController');
    var dialogs = require('web.view_dialogs');
    var core = require('web.core');
    var time = require('web.time');
    var Dialog = require('web.Dialog');

    var _t = core._t;

    var GanttController = AbstractController.extend({
        custom_events: _.extend({}, AbstractController.prototype.custom_events, {
            onDateChange: '_onDateChange',
            // TODO: Add "open/edit action" on double-click (need double-click support in frappe-gantt)
            onOpenEdit: '_onOpenEdit',
            // TODO: Add group support to frappe-gantt
            onGroupClick: '_onGroupClick',
            // TODO: Add "remove action"
            onRemove: '_onRemove',
            // TODO: Add "add action"
            onAdd: '_onAdd',
        }),

        /**
         * @constructor
         * @override
         */
        init: function (parent, model, renderer, params) {
            this._super.apply(this, arguments);
            this.open_popup_action = params.open_popup_action;
            this.date_start = params.date_start;
            this.date_stop = params.date_stop;
            this.date_delay = params.date_delay;
            this.context = params.actionContext;
            this.moveQueue = [];
            this.debouncedInternalMove = _.debounce(this.internalMove, 0);
        },

        /**
         * @override
         */
        update: function (params, options) {
            var res = this._super.apply(this, arguments);
            if (_.isEmpty(params)){
                return res;
            }
            var self = this;
            var domains = params.domain;
            var contexts = params.context;
            var group_bys = params.groupBy;
            this.last_domains = domains;
            this.last_contexts = contexts;
            // select the group by
            var n_group_bys = [];
            if (this.renderer.arch.attrs.default_group_by) {
                n_group_bys = this.renderer.arch.attrs.default_group_by.split(',');
            }
            if (group_bys.length) {
                n_group_bys = group_bys;
            }
            this.renderer.last_group_bys = n_group_bys;
            this.renderer.last_domains = domains;

            var fields = this.renderer.fieldNames;
            fields = _.uniq(fields.concat(n_group_bys));
            return $.when(
                res,
                self._rpc({
                    model: self.model.modelName,
                    method: 'search_read',
                    kwargs: {
                        fields: fields,
                        domain: domains,
                    },
                    context: self.getSession().user_context,
                }).then(function (records) {
                    return self.renderer.on_data_loaded(records, n_group_bys);
                })
            );
        },

        /**
         * Gets triggered when a gantt task is moved or resized
         * (triggered by the GanttRenderer).
         *
         * @private
         */
        _onDateChange: function (event) {
            var view = this.renderer.view;
            var fields = view.fields;
            var task = event.data.task;
            var task_start = event.data.start;
            var task_end = event.data.end;
            console.log('task_start', task_start, 'task_end', task_end)

            var data = {};
            // In case of a move event, the date_delay stay the same, only date_start and stop must be updated
            data[this.date_start] = time.auto_date_to_str(task_start, fields[this.date_start].type);
            if (this.date_stop) {
                // In case of instantaneous event, task.end is not defined
                if (task_end) {
                    data[this.date_stop] = time.auto_date_to_str(task_end, fields[this.date_stop].type);
                } else {
                    data[this.date_stop] = data[this.date_start];
                }
            }
            if (this.date_delay && task_end) {
                var diff_seconds = Math.round((task_end.getTime() - task_start.getTime()) / 1000);
                data[this.date_delay] = diff_seconds / 3600;
            }
            console.log('data', data)

            // TODO: Add group support to frappe-gantt
            var group = false;
            if (task.group !== -1) {
                group = task.group;
            }
            if (this.renderer.last_group_bys && this.renderer.last_group_bys instanceof Array) {
                data[this.renderer.last_group_bys[0]] = group;
            }

            var move_item = {
                id: task.record.id,
                data: data,
                event: event
            }
            this.moveQueue.push(move_item);
            this.debouncedInternalMove();
        },

        /**
         * Write enqueued moves to Odoo. After all writes are finished it updates the view once
         * (prevents flickering of the view when multiple gantt items are moved at once).
         *
         * @returns {jQuery.Deferred}
         */
        internalMove: function () {
            var self = this;
            var queue = this.moveQueue.slice();
            this.moveQueue = [];
            var defers = [];
            _.each(queue, function(move_item) {
                defers.push(self._rpc({
                    model: self.model.modelName,
                    method: 'write',
                    args: [
                        [move_item.id],
                        move_item.data,
                    ],
                    context: self.getSession().user_context,
                }).then(function() {
                    move_item.event.data.callback(move_item.event.data.task);
                }));
            });
            return $.when.apply($, defers).done(function() {
                self.write_completed({
                    adjust_window: false
                });
            });
        },

        /**
         * Gets triggered when a group in the gantt is clicked (by the GanttRenderer).
         * TODO: Add group support to frappe-gantt
         *
         * @private
         * @returns {jQuery.Deferred}
         */
        _onGroupClick: function (event) {
            var groupField = this.renderer.last_group_bys[0];
            return this.do_action({
                type: 'ir.actions.act_window',
                res_model: this.renderer.view.fields[groupField].relation,
                res_id: event.data.task.group,
                target: 'new',
                views: [[false, 'form']]
            });
        },

        /**
         * Opens a form view of a clicked gantt item 
         * (triggered by the GanttRenderer).
         * 
         * @private
         */
        _onOpenEdit: function (event) {
            var self = this;
            this.renderer = event.data.renderer;
            var rights = event.data.rights;
            var task = event.data.task;
            var id = task.record.id;
            var title = task.record.__name;
            if (this.open_popup_action) {
                new dialogs.FormViewDialog(this, {
                    res_model: this.model.modelName,
                    res_id: parseInt(id, 10).toString() === id ? parseInt(id, 10) : id,
                    context: this.getSession().user_context,
                    title: title,
                    view_id: Number(this.open_popup_action),
                    on_saved: function () {
                        self.write_completed();
                    },
                }).open().on('closed', this, function () {
                    event.data.callback();
                });
            } else {
                var mode = 'readonly';
                if (rights.write) {
                    mode = 'edit';
                }
                this.trigger_up('switch_view', {
                    view_type: 'form',
                    res_id: parseInt(id, 10).toString() === id ? parseInt(id, 10) : id,
                    mode: mode,
                    model: this.model.modelName,
                });
            }
        },

        /**
         * Triggered when a gantt item gets removed from the view.
         * Requires user confirmation before it gets actually deleted.
         * TODO: Add "remove action"
         *
         * @private
         * @returns {jQuery.Deferred}
         */
        _onRemove: function (e) {
            var self = this;

            function do_it(event) {
                return self._rpc({
                    model: self.model.modelName,
                    method: 'unlink',
                    args: [
                        [event.data.task.record.id],
                    ],
                    context: self.getSession().user_context,
                }).then(function () {
                    var unlink_index = false;
                    for (var i = 0; i < self.model.data.records.length; i++) {
                        if (self.model.data.records[i].id === event.data.task.record.id) {
                            unlink_index = i;
                        }
                    }
                    if (!isNaN(unlink_index)) {
                        self.model.data.records.splice(unlink_index, 1);
                    }

                    event.data.callback(event.data.task);
                });
            }

            var message = _t("Are you sure you want to delete this record?");
            var def = $.Deferred();
            Dialog.confirm(this, message, {
                title: _t("Warning"),
                confirm_callback: function() {
                    do_it(e)
                        .done(def.resolve.bind(def, true))
                        .fail(def.reject.bind(def));
                },
            });
            return def.promise();
        },

        /**
         * Triggered when a gantt task gets added and opens a form view.
         * TODO: Add "add action"
         *
         * @private
         */
        _onAdd: function (event) {
            var self = this;
            var task = event.data.task;
            // Initialize default values for creation
            var default_context = {};
            default_context['default_'.concat(this.date_start)] = task.start;
            if (this.date_delay) {
                default_context['default_'.concat(this.date_delay)] = 1;
            }
            if (this.date_start) {
                default_context['default_'.concat(this.date_start)] = moment(task.start).add(1, 'hours').format(
                    'YYYY-MM-DD HH:mm:ss'
                );
            }
            if (this.date_stop && task.end) {
                default_context['default_'.concat(this.date_stop)] = moment(task.end).add(1, 'hours').format(
                    'YYYY-MM-DD HH:mm:ss'
                );
            }
            if (task.group > 0) {
                default_context['default_'.concat(this.renderer.last_group_bys[0])] = task.group;
            }
            // Show popup
            new dialogs.FormViewDialog(this, {
                res_model: this.model.modelName,
                res_id: null,
                context: _.extend(default_context, this.context),
                view_id: Number(this.open_popup_action),
                on_saved: function (record) {
                    self.create_completed([record.res_id]);
                },
            }).open().on('closed', this, function () {
                event.data.callback();
            });

            return false;
        },

        /**
         * Triggered upon completion of a new record.
         * Updates the gantt view with the new record.
         *
         * @returns {jQuery.Deferred}
         */
        create_completed: function (id) {
            var self = this;
            return this._rpc({
                model: this.model.modelName,
                method: 'read',
                args: [
                    id,
                    this.model.fieldNames,
                ],
                context: this.context,
            })
            .then(function (records) {
                var new_task = self.renderer.record_data_transform(records[0]);
                var tasks = self.renderer.gantt.tasks;
                tasks.add(new_task);
                self.renderer.gantt.refresh(tasks);
                self.reload();
            });
        },

        /**
         * Triggered upon completion of writing a record.
         */
        write_completed: function (options) {
            var params = {
                domain: this.renderer.last_domains,
                context: this.context,
                groupBy: this.renderer.last_group_bys,
            };
            this.update(params, options);
        },
    });

    return GanttController;
});
