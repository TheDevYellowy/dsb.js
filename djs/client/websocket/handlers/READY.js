'use strict';

const ClientApplication = require('../../../structures/ClientApplication');
const User = require('../../../structures/User');
let ClientUser;

module.exports = (client, { d: data }, shard) => {
  if (client.user) {
    client.user._patch(data.user);
  } else {
    ClientUser ??= require('../../../structures/ClientUser');
    client.user = new ClientUser(client, data.user);
    client.users.cache.set(client.user.id, client.user);
  }

  for (const guild of data.guilds) {
    guild.shardId = shard.id;
    client.guilds._add(guild);
  }

  for (const relation of data.relationships) {
    const user = new User(client, relation.user)
    if(relation.type == 1) {
      client.friends.cache.set(user.id, user)
    } else if (relation.type == 2) {
      client.blocked.cache.set(user.id, user)
    }
  }

  if (client.application) {
    client.application._patch(data.application);
  } else {
    client.application = new ClientApplication(client, data.application);
  }

  shard.checkReady();
};
