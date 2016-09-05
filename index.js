var buildDictionary = require('sails-build-dictionary');
var path = require('path');

module.exports = function (sails) {

  return {
    initialize: function (next) {
      loadSerializers(function(err, serializers) {
        sails.serializers = { all_serializers: serializers };

        // Expose services as globals
        _.each(sails.services, function(service) {
          var globalName = service.globalId || service.identity;
          global[globalName] = service;
        });
      });
      next();
    }
  }

  function loadSerializers(cb) {
    dic_options = {
      dirname       : path.resolve(sails.config.appPath, 'api/serializers'),
      filter        : /(.+)\.(js|coffee|litcoffee)$/,
      depth         :5,
      useGlobalIdForKeyName: true,
      identity: false
    }

    buildDictionary.optional(dic_options, bindToSails(cb))
  };

  function bindToSails(cb) {
    return function(err, serializers) {
      if(err) { return cb(err); }
      serializers = _.map(serializers, function(v, k) { var ser = {}; ser[k] = v; return ser })
      _.forEach(serializers, function(serializer) { _.bindAll(serializer); });
      return cb(null, serializers);
    }
  };

};
