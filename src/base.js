/*
 * basecrm driver for nodejs
 *
 * copyright 2014 nuno job <nunojob.com> (oO)--',--
 *
 */
/* jshint node:true */
/* jshint laxcomma:true */

'use strict';

var request = require('request')
  , defaultEndpoint = 'https://sales.futuresimple.com/api/v1'
  , basecrm
  ;

function BaseClient(opts) {
  this.opts = {};
  this.opts.endpoint = opts.endpoint || defaultEndpoint;
  this.opts.token = opts.token;
}

BaseClient.prototype.createNewDeal = function(opts, cb) {
  var organizationName = opts.company
    , personNames = opts.from_name.split(' ')
    , personEmail = opts.from_email
    , emailSubject = opts.subject
    , emailBody = opts.text
    , lastName = 'not given'
    , firstName
    , basecli = this
    ;

  if(personNames.length > 1) {
    firstName = personNames[0];
    lastName = personNames[1];
  } else {
    firstName = personNames[0];
  }

  request(
    { uri: basecli.endpoint + '/contacts'
    , method: 'POST'
    , headers:
      {
        'X-Pipejump-Auth': basecli.token
      }
    , json:
      { 'contact[is_organisation]': true
      , 'contact[name]': organizationName
      }
    }, function (err, _, org) {
      if(err) {
        return cb(err);
      }

      if (org.errors)
        cb(org.errors);
      else
        request(
          { uri: basecli.endpoint + '/contacts'
          , method: 'POST'
          , headers:
            {
              'X-Pipejump-Auth': basecli.token
            }
          , json:
            { 'contact[last_name]': lastName
            , 'contact[first_name]': firstName
            , 'contact[email]': personEmail
            }
          }, function (err, _, person) {
            var orgId = org.contact.id;
            if(!orgId)
              return cb(new Error('Failed creating organization'));
            if(err) {
              return cb(err);
            }

            if (person.errors)
              cb(person.errors);
            else {
              var personId = person.contact.id;
              if(!personId)
                return cb(new Error('Failed creating person'));

              request(
                { uri: basecli.endpoint + '/deals'
                , method: 'POST'
                , headers:
                  {
                    'X-Pipejump-Auth': basecli.token
                  }
                , json:
                  { 'name': organizationName + ' — ' + emailSubject
                  , 'entity_id': orgId
                  }
                }, function (err, _, deal) {
                  if(err) {
                    return cb(err);
                  }

                  if (deal.errors)
                    cb(deal.errors);
                  else {

                  }
              });
            }
        });
    });
};

function createClient(opts, cb) {
  authenticate(opts, function (err, token) {
    if(err)
      return cb(err);
    opts.token = token;
    var client = new BaseClient(opts);
    return cb(null, client);
  });
}

function authenticate (opts, cb) {
  request(
    { uri: (opts.endpoint || defaultEndpoint) + '/authentication'
    , method: 'POST'
    , json: { email: opts.email, password: opts.password }
    }, function (err, _, data) {
      if (err)
        return cb(err);
      if(data.authentication && data.authentication.token)
        cb(null, data.authentication.token);
      else
        cb(new Error('Authentication failed'));
    });
}

module.exports = exports = basecrm = function basecrm() {
  return {
    createClient: createClient
  };
};

basecrm.version = require('../package').version;
basecrm.path    = __dirname;
