var _             = require('lodash');
var pluralize     = require('pluralize');
var Promise       = require('bluebird');
var Cereal        = require('./Cereal.js');


var Cerealize = function (records, config, master) {

  var self = this
  if (!config) {
    sails.log.debug('No config given to cerealizer.')
  } else {
    self.config = config
  }

  self.stop_propagate = []

  if (master && master.name) {
    self.master = master.master
    self.is_master = false
    self.is_slave = true
  } else {
    self.master = self
    self.is_master = true
    self.is_slave = false
  }

  self.plural = _.isArray(records)

  self.name = Cereal.findSerializerName(config)

  self.serializer = sails.serializers[self.name]

  self.serializers = sails.serializers

  if (!self.serializer.config) {
    sails.log.debug('No Cerealizer config found for ' + self.serializer.identity)
    return
  }

  self.build = self.serializer.setBuild(records, self.master)

  self.json = Cereal.createInitialJson(records, self.serializer)

  self.type = self.serializer.type

  self.promises = []
  self.key_promises = []
  self.json_promises = []
  self.catch_results = []

  if (self.plural) {
    _.each(self.serializer.types, function(type) {
      if (self.type == type) {
        // console.log('plural type')
        // console.log(type)
        self.json_promises = _.map(self.json[self.serializer.identity], function(base_json) {
          var result = self.serializer[type](base_json, _.filter(records, { id: base_json['id'] })[0], self)
          if (!result) {
            sails.log.debug('Fail on: \n' + 'type: ' + type + '\n' + 'identity:' + self.serializer.identity )
            return self.json
          }
          if (typeof result == 'object' || _.isFunction(result)) {
            return Promise.promisifyAll(result)
          }
        })
      }
    })
  } else {
    _.each(self.serializer.types, function(type) {
      if (self.type == type) {
        // console.log('single type')
        // console.log(type)
        var base_json = self.json[self.serializer.identity]
        var result = self.serializer[type](base_json, records, self)
        if (typeof result == 'object' || _.isFunction(result)) {
          self.json_promises.push(Promise.promisifyAll(self.serializer[type](base_json, records, self)))
        }
        // self.json_promises = _.map(self.json[self.serializer.identity], function(base_json) { return Promise.promisifyAll(self.serializer[type](base_json, records) )})
      }
    })
  }

  this.waitPromises = function () {
    var self = this
    return Promise.all(self.json_promises).then(function(result) {
      if (result.length === self.json_promises.length) {
        json = self.json
        return json;
      } else {
        sails.log.debug('waitPromises ' + self.name);
      //   sails.log.debug('If you are using Cerealize in the ' + self.name + ' serializer, be sure to new it up instead of using the instance method.')
        return self.waitPromises()
      }
    });
  };

  return this.waitPromises();
}


module.exports = Cerealize