var Promise = require('bluebird')

module.exports = {
  findSerializerName: function(config) {
    if (config.serializer != null && config.each_serializer != null) {
      sails.log.debug('Cannot specify serializer: ' + config.serializer + ' and each_serializer: ' + config.each_serializer +' in a unique cerealizer.')
      return null
    }
    var name;

    if (config.serializer != null) {
      name = config.serializer.toLowerCase();
    } else if (config.each_serializer != null) {
      name = config.each_serializer.toLowerCase();
    } else {
      sails.log.debug('Must define a serializer in the config.')
    }
    return name;
  },

  buildBaseAttributes: function(object, attributes) {
    _.each(attributes, function(att) { object[att] = null })
    return object
  },

  createInitialJson: function(records, serializer) {
    var self = this

    var json = {}
    // var template_record = this.build.template_record
    // var non_attribute_injections = this.getNonAttributeInjections(this.config, template_record)
    var attributes = serializer.build.attributes

    if (_.isArray(records)) {
      json[serializer.identity] = _.map(records, function(record) { 
        object = { id: record.id }
        _.each(attributes, function(att) { 
          object[att] = null
          // var test = self.getConfigValue(serializer.config, att)
          // console.log('Test')
          // console.log(test[0])
          // if (_.isFunction(test[0])) {
          //   if (self.isPromise(test[0](record))) {
          //     test[0](record).then(function(res) {
          //       object[att] = res[Object.keys(res)[0]]
          //     })
          //   } else {
          //     object[att] = test[0](record)
          //     // Promise.promisifyAll(test[0](record)).then(function(res) {
          //     //   console.log('after prom')
          //     //   console.log(res)
          //     //   object[att] = res
          //     // })
          //   }
          // }
        })
        return object
      })
    }
    else {
      json[serializer.identity] = this.buildBaseAttributes({ id: records.id }, attributes)
    }
    return json
  },

  getConfigValue: function(config, name) {
    var val = _.chain(config)
               .map(function(conf) {
                 if (conf.hasOwnProperty(name)) {
                   return conf[name]
                 } else {
                   return null
                 }
               })
               .compact()
               .flatten()
               .value()
    return val
  },

  getAttributeInjections: function(config, record) {
    var attribute_injections = _.chain(config)
                                .map(function(conf) {
                                  if ( _.contains(Object.keys(record), Object.keys(conf)[0] ) ) {
                                    return conf
                                  } else {
                                    return null
                                  }
                                })
                                .compact()
                                .flatten()
                                .value()
    return attribute_injections
  },

  getNonAttributeInjections: function(config, record) {

    var blacklist = ['attributes', 'has_many', 'has_one']

    blacklist += Object.keys(record)
    var non_attribute_injections = _.chain(config)
                                    .map(function(conf) {
                                      if ( !_.contains(blacklist, Object.keys(conf)[0] ) ) {
                                        return conf
                                      } else {
                                        return null
                                      }
                                    })
                                    .compact()
                                    .flatten()
                                    .value()
    return non_attribute_injections
  },

  getTemplateRecord: function(records) {
    if (_.isArray(records)) {
      return records[0]
    } else {
      return records
    }
  },

  isPromise: function(object) { return object instanceof Object && _.contains(object.toString(), 'Promise'); }

}