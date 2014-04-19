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
  , qs = require('querystring')
  , log = require('debug')('base:base')
  , defaultEndpoint = 'https://sales.futuresimple.com/api/v1'
  , basecrm
  ;

function BaseCRM(opts) {
  this.endpoint = opts.endpoint || defaultEndpoint;
  this.token = opts.token;
}

BaseCRM.prototype.relax = function (opts, cb) {
  var reqOpts = {
      uri: this.endpoint + opts.path
    , method: opts.method
    , headers:
      { 'Content-Type': 'application/json'
      , 'X-Pipejump-Auth': this.token
      }
    , json: true
    };

  if(typeof opts.data === 'object') {
    reqOpts.uri += '?' + qs.stringify(opts.data);
  }

  log(JSON.stringify(reqOpts));

  request(reqOpts, function (err, headers, data) {
    if(err) {
      log(err);
      return cb(err);
    }

    if (data.errors) {
      log(data);
      cb(JSON.stringify(data.errors));
    }
    else {
      log(JSON.stringify(data), headers.statusCode);
      if (headers.statusCode >= 200 && headers.statusCode < 400) {
        cb(null, data);
      } else {
        cb(new Error('Request failed with code ' + headers.statusCode));
      }
    }
  });
};

BaseCRM.prototype.createNoteForContact = function (opts, cb) {
  this.relax({
      path: '/contacts/' + opts.contactId + '/notes'
    , method: 'POST'
    , data: { 'note[content]': opts.note }
  }, cb);
};

BaseCRM.prototype.deleteNoteForContact = function (opts, cb) {
  this.relax({
      path: '/contacts/' + opts.contactId + '/notes/' + opts.noteId
    , method: 'DELETE'
  }, cb);
};

BaseCRM.prototype.getNoteForContact = function (opts, cb) {
  this.relax({
      path: '/contacts/' + opts.contactId + '/notes/' + opts.noteId
  }, cb);
};

BaseCRM.prototype.createContact = function (data, cb) {
  this.relax({
    path: '/contacts.json',
    method: 'POST',
    data: data
  }, cb);
};

BaseCRM.prototype.deleteContact = function (opts, cb) {
  this.relax({
    path: '/contacts/' + opts.contactId,
    method: 'DELETE'
  }, cb);
};

BaseCRM.prototype.getContact = function (opts, cb) {
  this.relax({
    path: '/contacts/' + opts.contactId
  }, cb);
};

BaseCRM.prototype.createDeal = function (data, cb) {
  this.relax({
    path: '/deals',
    method: 'POST',
    data:
      { name: data.name
      , entity_id: data.contactId
      }
  }, cb);
};

BaseCRM.prototype.createOrganization = function (opts, cb) {
  this.createContact(
    { 'contact[is_organisation]': true
    , 'contact[name]': opts.contactName
    }, cb);
};

BaseCRM.prototype.createPerson = function (opts, cb) {
  this.createContact(
    { 'contact[last_name]': opts.contactLastName
    , 'contact[first_name]': opts.contactFirstName
    , 'contact[email]': opts.contactEmail
    }, cb);
};

BaseCRM.prototype.createDealFromScratch = function(opts, cb) {
  var organizationName = opts.company
    , personNames = opts.from_name.split(' ')
    , personEmail = opts.from_email
    , emailSubject = opts.subject
    , emailBody = opts.text
    , lastName = 'not given'
    , self = this
    , response = {}
    , firstName
    , orgId
    , personId
    , dealId
    ;

  if(personNames.length > 1) {
    firstName = personNames[0];
    lastName = personNames[1];
  } else {
    firstName = personNames[0];
  }

  self.createOrganization({
    contactName: organizationName
  }, function (err, data) {
    if (err)
      return cb(err, response);

    response.organization = (data.contact || data.organization);
    orgId = response.organization.id;

    self.createPerson(
      { contactLastName: lastName
      , contactFirstName: firstName
      , contactEmail: personEmail
      }, function (err, data) {
      if (err)
        return cb(err, response);

      response.person = data.contact;
      personId = response.person.id;

      self.createDeal({
          name: organizationName + ' — ' + emailSubject
        , contactId: personId
      }, function (err, data) {
        if (err)
          return cb(err, response);

      response.deal = data.deal;
      dealId = data.deal.id;

      self.createNoteForContact(
        { contactId: personId
        , note: emailBody
        }, function (err, data) {
          if(err)
            return cb(err, response);

          response.note = data.note;

          cb(null, response)

        });
      });
    });
  });

};

function createClient(opts, cb) {
  authenticate(opts, function (err, token) {
    if(err)
      return cb(err);
    opts.token = token;
    var client = new BaseCRM(opts);
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


BaseCRM.prototype.contact = (function () {
  return {
    create: BaseCRM.prototype.createContact.bind(this)
  , del: BaseCRM.prototype.deleteContact.bind(this)
  , get: BaseCRM.prototype.getContact.bind(this)
  , note:
    {
      create: BaseCRM.prototype.createNoteForContact.bind(this)
    }
  };
})();

BaseCRM.prototype.person = BaseCRM.prototype.contact;
BaseCRM.prototype.organization = BaseCRM.prototype.contact;

BaseCRM.prototype.person.create = (function () {
  return BaseCRM.prototype.createPerson.bind(this);
})();

BaseCRM.prototype.person.create = (function () {
  return BaseCRM.prototype.createPerson.bind(this);
})();

module.exports = exports = basecrm = function basecrm() {
  return {
    createClient: createClient
  };
};

basecrm.version = require('../package').version;
basecrm.path    = __dirname;
