'use strict';

const Action = require('./Action');
const { Events } = require('../../util/Constants')

class RelationshipAddAction extends Action {
    handle(data) {
        console.log(data)
    }
}

module.exports = RelationshipAddAction
