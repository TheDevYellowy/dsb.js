'use strict';

module.exports = (client, packet) => {
    client.actions.RelationshipAdd.handle(packet.d);
}