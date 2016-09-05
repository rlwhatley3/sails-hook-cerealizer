
var Cereal = require('./Cereal.js')
var Promise       = require('bluebird');
var Cerealize = require('./Cerealize.js')

var Cerealizer = function (config) {

  if (config) {
    this.config = config;
  }

  this.types = ['standard', 'standard_functional' ,'deep', 'deep_functional', 'unknown'],

  this.serialize_standard_promise_functional = function(base_json, result, att_name) {
    base_json[att_name] = result[0][Object.keys(result[0])[0]]
    return base_json
  },

  this.resolveAll = function(base_json) {
    var self = this
    if (base_json) {
      return base_json
    } else {
      return Promise.all(self.build.promises)
    }
  },

  this.standard = function(base_json, record) {
    _.each(Object.keys(base_json), function(json_key) {
      if (record.hasOwnProperty(json_key) && base_json[json_key] == null) {
        base_json[json_key] = record[json_key]
      }
    })
    return this.resolveAll(base_json)
  },

  this.standard_functional = function(base_json, record) {
    var self = this
    var base_json = base_json

    _.forEach(self.build.non_attribute_injections, function(nai) {
      var result = nai[Object.keys(nai)[0]](record)
      if (Cereal.isPromise(result)) {
        self.build.promises.push(result);
        self.resolveAll().then(function(ret) {
          self.build.promises = [];
          base_json = self.serialize_standard_promise_functional(base_json, ret, Object.keys(nai)[0]);
          return base_json;
        })
      } else {
        base_json[Object.keys(nai)[0]] = result;
      }
    });
    base_json = self.standard(base_json, record);

    return base_json;
  },

  this.setHasX = function(base_json, record, caller) {
    var self = this;
    _.each(self.build.has_ones.concat(self.build.has_manys), function(has_x) {
      var att_name = Object.keys(has_x)[0];
      if (caller.is_master) {
        console.log('Caller: ' + caller.name + ', is a master');
      } else if (caller.is_slave) {
        console.log('>>>>>>>>>>>>>>>>>>');
        console.log('Caller: ' + caller.name + ', is slave to ' + caller.master.name);
        console.log('Builder is: ' + self.build.caller.name);
        console.log('check >>>');
        console.log(caller.is_slave && caller.master.name == self.build.caller.name);
        console.log('record');
        console.log(record);
        console.log('>>>>>>>>>>>>>>>>>>');
      }
      has_x_config = has_x[att_name];
      if (caller.is_slave && caller.master.name == self.build.caller.name ) {
        // if (_.contains(caller.stop_propagate, this.name)) {
        //   if (record[att_name]) {
            
        //   }
        // }
        // a stupid way to check if the record exists, but if the record isn't populated with a collection attribute, the orm still
        // serves up the attribute on the record, but as an object with only add: and remove: methods on it, so if it has more than 2,
        // it is populated
        if (record[att_name] && typeof record[att_name] == 'object' && Object.keys(record[att_name]).length > 2) {
          look_ahead = new Cerealize(record[att_name], has_x_config, caller);
          if (look_ahead.name == caller.serializer.name || look_ahead.serializer.name == caller.master.serializer.name) {
            caller.stop_propagate.push(look_ahead.name);
          }
          // if look_ahead.config.has_x.serializer == caller.master.serializer
          look_ahead.then(function(res) {
            base_json[att_name] = res[Object.keys(res)[0]];
            return base_json;
          })
          return base_json;
        } else if (record[att_name] && typeof record[att_name] != 'object') {
          base_json[att_name] = record[att_name];
          return base_json;
        } else {
          base_json[att_name] = null;
          sails.log.debug('Slave has no attribute: ' + att_name);
          return base_json;
        }
      } else if (caller.is_master) {
        if (typeof record[att_name] == 'object'  && Object.keys(record[att_name]).length > 2) {
          new Cerealize(record[att_name], has_x[att_name], caller ).then(function(res) {
            base_json[att_name] = res[Object.keys(res)[0]];
            return base_json;
          })
          // base_json[att_name] = new Cerealize(record[att_name], has_x[att_name], caller )
          // self.build.deep_promises.push(base_json[att_name])
          return base_json;
        // att_value = new Cerealize(record[att_name], has_x[att_name], caller )
        } else {
          if (_.contains(Object.keys(base_json), att_name)) {
            base_json[att_name] = null;
            sails.log.debug('Master has no attribute: ' + att_name);
          }
          return base_json;
        }
      }
    })
    return base_json;
  },

  this.deep = function (base_json, record, caller) {
    var self = this;

    base_json = self.setHasX(base_json, record, caller);

    var waitPromises = function(cerealizer) {
      var self = cerealizer;
      return Promise.all(cerealizer.build.deep_promises).then(function(res) {
        if (res.length === self.build.deep_promises.length) {
          self.deep_promises = [];
          return base_json;
        } else {
          sails.log.debug('Awaiting Promises')
          waitPromises(self);
        }
      })
    }
    waitPromises(self).then(function(res) {
      base_json = self.standard_functional(base_json, record);
      return base_json;
    })
    return base_json;
  },

  this.deep_functional = function (base_json, record) {

  },

  this.setBuild = function(records, caller) {
    var template_record = Cereal.getTemplateRecord(records);

    this.build = {
      caller: caller,
      promises: [],
      records: records,
      template_record: template_record,
      deep_promises: [],
      standard_functional_promises: [],
      attributes: Cereal.getConfigValue(this.config, 'attributes'),
      has_ones: Cereal.getConfigValue(this.config, 'has_one'),
      has_manys: Cereal.getConfigValue(this.config, 'has_many'),
      attribute_injections: Cereal.getAttributeInjections(this.config, template_record),
      non_attribute_injections: Cereal.getNonAttributeInjections(this.config, template_record),
    }

    this.build.has_ones_names = _.map(this.build.has_ones, function(ho) { return Object.keys(ho)[0]});
    this.build.has_manys_names = _.map(this.build.has_manys, function(hm) { return Object.keys(hm)[0] });
    this.build.attribute_injections_names = _.map(this.build.attribute_injections, function(ai) { return Object.keys(ai)[0] });
    this.build.non_attribute_injections_names = _.map(this.build.non_attribute_injections, function(nai) { return Object.keys(nai)[0] });
    this.build.has_x = this.build.has_ones + this.build.has_manys;
    this.build.has_x_names = this.build.has_ones_names + this.build.has_manys_names;
  
    if (this.build.has_x.length == 0 && this.build.attribute_injections.length == 0 && this.build.non_attribute_injections.length == 0) {
      this.type = 'standard'
    }

    // standard_functional ->
    //  has attributes, and non_attribute_injections
    else if (this.build.has_x.length == 0 && this.build.attribute_injections.length == 0 && this.build.non_attribute_injections.length > 0) {
      this.type = 'standard_functional'
    }

    // deep ->
    // has attributes, && has_x > 0 || attribute_injections > 0
    //  has attributes, && (has_ones &&/|| has_manys) && attribute_injects != (has_ones || has_manys)
    else if ( (this.build.has_x.length > 0 && this.build.attribute_injections.length > 0 && !_.includes(this.build.has_x_names, this.build.attribute_injections_names)  || (this.build.has_x.length > 0 && this.build.attribute_injections.length == 0) || (this.build.has_x.length == 0 && this.build.attribute_injections.length > 0) ) ) {
      this.type = 'deep'
    }

    // deep_functional ->
    //  has attributes && (has_ones &&/|| has_manys) && attribute_injects == (has_ones || has_manys)
    else if ( (this.build.has_x.length > 0 && this.build.attribute_injections.length > 0 && _.includes(this.build.has_x_names, this.build.attribute_injections_names) ) ) {
      this.type = 'deep_functional'
    }

  }

  return
};


module.exports = Cerealizer