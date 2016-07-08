'use strict';

var Spawn = require('easy-spawn');
var util = require('util');
var xml2js = require('xml2js');
var async = require('async');
var fs = require('fs');


var Client = function(options) {
    this.option({
        program: 'svn'
    }).option(options);
};

util.inherits(Client, Spawn);

Client.prototype.cmd = function(params, callback) {
    if (!util.isArray(params)) {
        params = [params];
    }
    if (this.getOption('username') !== undefined) {
        params.push('--username', this.getOption('username'));
    }
    if (this.getOption('password') !== undefined) {
        params.push('--password', this.getOption('password'));
    }

    return Client.super_.prototype.cmd.call(this, params, callback);
};

/*
    SVN commands
 */

Client.prototype.checkout = function(params, callback) {
    // try making dir
    var cwd = this.getOption('cwd');
    if (cwd !== undefined && !fs.existsSync(cwd)) {
        fs.mkdirSync(cwd);
    }

    if (typeof params === 'function') {
        callback = params;
        params = null;
    }

    // Default path 
    if (typeof params === 'array' && params.length === 1) {
        params.splice(1, 0, '.');
    }
    else if (typeof params === 'string') {
        params = [params, '.'];
    }

    params = Spawn.joinParams('checkout', params);
    
    this.cmd(params, callback);
};

Client.prototype.update = function(params, callback) {
    if (typeof params === 'function') {
        callback = params;
        params = null;
    }
    params = Spawn.joinParams('update', params);

    this.cmd(params, callback);
};

Client.prototype.commit = function(params, callback) {
    if (typeof params === 'function') {
        callback = params;
        params = null;
    }
    params = Spawn.joinParams(['commit', '-m'], params);

    this.cmd(params, callback);
};

Client.prototype.add = function(params, callback) {
    if (typeof params === 'function') {
        callback = params;
        params = null;
    }
    params = Spawn.joinParams('add', params);

    this.cmd(params, callback);
};

Client.prototype.del = function(params, callback) {
    if (typeof params === 'function') {
        callback = params;
        params = null;
    }
    params = Spawn.joinParams('delete', params);

    this.cmd(params, callback);
};

Client.prototype.info = function(params, callback) {
    if (typeof params === 'function') {
        callback = params;
        params = null;
    }

    params = Spawn.joinParams('info', params);
    
    this.cmd(params, callback);
};

/**
 * svn info with parsed info in callback
 * @param  {Mixed}   params
 * @param  {Function} callback
 */
Client.prototype.getInfo = function(params, callback) {
    if (typeof params === 'function') {
        callback = params;
        params = null;
    }
    var self = this;

    params = Spawn.joinParams(['info', '--xml'], params),
    
    async.waterfall([
        function(callback) {
            self.session('silent', true).cmd(params, callback);
        },
        function(data, callback) {
            xml2js.parseString(data, 
                {
                    explicitRoot: false, 
                    explicitArray: false
                },
                callback
            );
        },
    ], function(err, data) {
        if (callback) {
            if (err) {
                callback(err);
            }
            else {
                callback(err, data.entry);
            }
        }
    });
};

Client.prototype.status = function(params, callback) {
    if (typeof params === 'function') {
        callback = params;
        params = null;
    }

    params = Spawn.joinParams('status', params);
    
    this.cmd(params, callback);
};

/**
 * svn status with parsed info in callback
 *
 * @see status list https://github.com/apache/subversion/blob/trunk/subversion/svn/schema/status.rnc
 * @param  {Mixed}   params
 * @param  {Function} callback
 */
Client.prototype.getStatus = function(params, callback) {
    if (typeof params === 'function') {
        callback = params;
        params = null;
    }
    var self = this;

    params = Spawn.joinParams(['status', '--xml'], params);

    async.waterfall([
        function(callback) {
            self.session('silent', true).cmd(params, callback);
        },
        function(data, callback) {
            xml2js.parseString(data, 
                {
                    explicitRoot: false,
                    explicitArray: false
                },
                callback
            );
        }
    ], function(err, data) {
        if (callback) {
            if (err) {
                callback(err);
            }
            else {
                var list = [];
                if ('target' in data) {
                    data = data.target;
                    if ('entry' in data) {
                        if (util.isArray(data.entry)) {
                            for (var i = 0; i < data.entry.length; i++) {
                                list.push(data.entry[i]);
                            }
                        } else {
                            list.push(data.entry);
                        }
                    }
                }
                callback(null, list);
            }
        }
    });
};

Client.prototype.log = function(params, callback) {
    if (typeof params === 'function') {
        callback = params;
        params = null;
    }

    params = Spawn.joinParams('log', params);
    this.cmd(params, callback);
};

/**
 * svn log with parsed info in callback
 * sample result:
 * <code>
 * [ 
 * { '$': { revision: '1' },
 *   author: 'dong',
 *   date: '2013-05-21T10:23:35.427701Z',
 *   msg: 'tt' 
 * } ...
 * ]
 * </code>
 * @param  {Mixed}   params
 * @param  {Function} callback
 */
Client.prototype.getLog = function(params, callback) {
    if (typeof params === 'function') {
        callback = params;
        params = null;
    }

    var self = this;

    params = Spawn.joinParams(['log', '--xml'], params);

    async.waterfall([
        function(callback) {
            self.session('silent', true).cmd(params, callback);
        }, 
        function(data, callback) {
            xml2js.parseString(data, 
                {
                    explicitRoot: false,
                    explicitArray: false
                },
                callback
            );
        }
    ], function(err, data) {
        if (callback) {
            if (err) {
                callback(err);
            }
            else {
                var list = [];
                if (util.isArray(data)) {
                    for (var i = 0; i < data.length; i++) {
                        list.push(data[i].logentry);
                    }
                }
                else if('logentry' in data) {
                    list.push(data.logentry);
                }
                callback(null, list);
            }
        }
    });
};

/**
 * Add all local changes to for commit
 * 
 * @param  {Object}   options
 *         - status
 * @param  {Function} callback
 */
Client.prototype.addLocal = function(options, callback) {
    if (typeof options === 'function') {
        callback = options;
        options = {
            status: null
        }
    }

    if (!'status' in options) {
        options.status = null;
    }

    var self = this;

    async.waterfall([
        function(callback) {
            self.getStatus(callback);
        },
        function(data, callback) {
            // do not run in parallel, or svn might be locked
            async.eachSeries(data, function(info, callback) {
                var path = info.$.path,
                    status = info['wc-status'].$.item;

                if (options.status === null || options.status.indexOf(status) !== -1) {
                    // add
                    if (['none', 'unversioned'].indexOf(status) !== -1) {
                        self.add(path, function(err) {
                            callback(err);
                        });
                    }
                    // delete
                    else if(['missing'].indexOf(status) !== -1) {
                        self.del(path, function(err) {
                            callback(err);
                        });
                    }
                    else {
                        callback(null);
                    }
                }
                else {
                    callback(null);
                }
            }, function(err) {
                callback(err);
            });
        }
    ], function(err) {
        callback && callback(err);
    });
};

Client.prototype.addLocalUnversioned = function(options, callback) {
    if (typeof options === 'function') {
        callback = options;
        options = {
        };
    }
    else if(options === undefined || options === null){
        options = {

        }
    }
    options.status = 'unversioned';
    this.addLocal(options, callback);
};



module.exports = Client;