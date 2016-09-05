### Sails-Hook-Cerealizer

Provides json serialization for nested records with similar syntax to the [ActiveModelSerializers](https://github.com/rails-api/active_model_serializers)


### The Cerealizer
  Start with a service that news up a Cerealizer on call (since they are being globally namespaced anyways), something like this.

```javascript
var Cerealize = require('sails-hook-cerealize/Cerealize.js');

module.exports = function(records, config)  { return (new Cerealize(records, config)); }
```


#### api/models:

Character
```coffeescript
module.exports =

  attributes: {

    name:
      type: 'string'

    is_public: 
      type: 'boolean'
      defaultsTo: () -> "false"

    experience:
      type: 'integer'
      defaultsTo: () -> 0

    base_ability_score:
      model: 'ability_score'
      dominant: true

    ability_score_modifications:
      collection: 'ability_score'
      dominant: true

    level:
      type: 'integer'
      defaultsTo:() -> 1
    #one race to one character
    race: 
      model: 'race'
      dominant: true 
    # one character to many klasses
    primary_class:
      model: 'klass'
      # defaultsTo:() -> some_filler_class
    # one character to many klasses
    secondary_classes:
      collection: 'klass'
      via: 'characters'
      dominant: true
    # one player to many characters
    created_by:
      model: 'user'

  },

  beforeCreate: (char, cb) ->
    if !char.base_ability_score
      Ability_score.create().exec((err, created) ->
        return cb(err) if err 
        char.base_ability_score = created.id
        cb()
      )
    else
      cb()

```

Race
```coffeescript
module.exports =

  attributes: {

    name:
      type: "string"

    description:
      type: "string"

    characters:
      collection: 'character'
      via: 'race'
  }

```

Klass
```coffeescript
module.exports =

  attributes: {

    name:
      type: 'string'

    description:
      type: 'string'

    level:
      type: 'integer'
      defaultsTo: () -> 1

    hit_dice_type:
      type: 'integer'

    hit_dice: 
      type: 'integer'

    characters:
      collection: 'character'
      via: 'secondary_classes'

  }

```

Ability Score
```coffeescript
module.exports =

  attributes: {

    strength:
      type: 'integer'
      defaultsTo:() -> 0

    dexterity:
      type: 'integer'
      defaultsTo:() -> 0

    constitution: 
      type: 'integer'
      defaultsTo:() -> 0

    intelligence:
      type: 'integer'
      defaultsTo:() -> 0

    wisdom: 
      type: 'integer'
      defaultsTo:() -> 0

    charisma:
      type: 'integer'
      defaultsTo:() -> 0

  }


```

### api/serializers
#### Serializer Naming Convention
  - CamelCasedSerializer.(js/coffee)

Serializers should export a new Cerealizer([params]) with an array of objects as its defining parameters.
The paramater objects should contain a single attribute named for its relationship to the passed in records.

##### attributes
  value should be an array of strings which keys the serialized output will have. Note that these must be either attributes already on the passed in record, or a self defined attribute listed in the serializer objects.

##### has_one
  value should be an object with an attribute named for the records attribute name it will serialize, and an attribute value that is a config object, with an attribute named 'serializer' and a value that is a string of the name of the serializer to be called. examples follow.

#### has_many
  value should be an object with an attribute named for the records attribute name it will serialize, and an attribute value that is a config object, with an attribute named 'each_serializer' and a value that is a string of the name of the serializer to be called. examples follow. nested has_manys that have has_manys of their initial json, are currently broken

#### user defined functions
  value may be an attribute named anything other than an attribute already on the record. The attribute value will be a function being passed in a record as the first argument. The return value from the function will be set to the value of attribute in the final serialized version. Returning of promises is currently broken.

#### future implentation** mimicked attribute functions
  value may be an attribute named for an attribute already on the record. The attribute value should be a function being passed in the records.attribute as the first argument, the record as the second argument, and the user as the third argument The return value would become the attributes value on the final serialized version, would be able to return promises.

CharacterSerializer
```coffeescript
CharacterSerializer = new Cerealizer([
  { attributes: ['name', 'race', 'standard_func', 'secondary_classes', 'primary_class', 'base_ability_score'] },
  { has_many: { secondary_classes: { each_serializer: 'Klass' } } },
  { has_one: { primary_class: { serializer: 'Klass' } } },
  { has_one: { race: { serializer: 'Race' } } },
  { has_one: { base_ability_score: { serializer: 'BaseAbilityScore' } } },

  { standard_func: (record, user) -> return record.id + '-' + record.name }

]);

module.exports = CharacterSerializer
```

RaceSerializer
```coffeescript
RaceSerializer = new Cerealizer([
  { attributes: ['name', 'description'] }
  # -> nested cross relations not supported yet { has_many: { characters: { each_serializer: 'Character' } } }
]);

module.exports = RaceSerializer
```

KlassSerializer
```coffeescript
KlassSerializer = new Cerealizer([
  { attributes: ['name', 'description', 'hit_dice_type', 'hit_dice', 'refill'] },
  { refill: (record) -> return "#{record.hit_dice}D#{record.hit_dice_type}" }
]);

module.exports = KlassSerializer
```

BaseAbilityScoreSerializer
```coffeescript
BaseAbilityScore = new Cerealizer([
  # { as: 'Ability_score' },
  { attributes: ['charisma', 'constitution', 'dexterity', 'intelligence', 'strength', 'wisdom'] }
]);

module.exports = BaseAbilityScore
```

### api/controllers

#### controller conventions
  provided your service is named Cerealize like mine is, you may call your serializer in the controller as below.
  You may notice, Cerealize returns a bluebird promise, so catch that return, and serve it up as you please. I have a packaging service here that checks for errors, and either returns the errors or the json after each catch.

```coffeescript
module.exports = {
  index: (req, res) ->
    Character.find()
    .populate('created_by')
    .populate('primary_class')
    .populate('secondary_classes')
    .populate('race')
    .populate('base_ability_score')
    .exec((err, characters) ->
      race_ids = _.map(characters, (c) -> c.race.id)
      Race.find(race_ids)
      .populate('characters')
      .exec((err, races) ->
        characters = _.map(characters, (c) -> c.race = _.filter(races, { id: c.race.id })[0]; return c;)
        Cerealize(characters, { each_serializer: 'Character' }).then (ret) ->
          return Packager.chego(req, res, err, ret[Object.keys(ret)[0]])
      )
    )
}
```

The above serialized data would appear as an object with an attribute equal to the given serializer name with an attribuite value of either an object or array of objects, which each may or may not be serialized, depending on your configuration:

```javascript
  { character: 
   [ { id: 1,
       name: 'BrothamireTheron',
       race: [Object],
       standard_func: '1-BrothamireTheron',
       promise_func: null,
       secondary_classes: [Object],
       primary_class: [Object],
       base_ability_score: [Object] 
     }, { 
      id: 2,
      name: 'Hodoor',
      race: [Object],
      standard_func: '2-Hodoor',
      promise_func: null,
      secondary_classes: [Object],
      primary_class: [Object],
      base_ability_score: [Object]
     }, {
      id: 3,
      name: 'Hodoor',
      race: [Object],
      standard_func: '3-Hodoor',
      promise_func: null,
      secondary_classes: [Object],
      primary_class: [Object],
      base_ability_score: [Object]
     }, {
      id: 4,
      name: 'scoob',
      race: [Object],
      standard_func: '4-scoob',
      promise_func: null,
      secondary_classes: [Object],
      primary_class: [Object],
      base_ability_score: [Object]
     } ]
  }

```