'use strict';

const ClientApplication = require('../../../structures/ClientApplication');
const { version } = require('../../../../package.json');
const User = require('../../../structures/User');
const axios = require('axios').default;
const chalk = require('chalk').default;
let ClientUser;

// Code from https://github.com/aiko-chan-ai
const checkUpdate = async () => {
  const res_ = await axios.get(`https://registry.npm.com/${encodeURIComponent('dsb.js')}`);

  const latest = res_.data['dist-tags'].latest;
  if(version.includes('-')) return;
  if(version !== latest) {
    return console.log(chalk.yellow(`You have an outdated version of dsb.js\nCurrent: ${version}\nLatest: ${latest}`));
  }
}

module.exports = (client, { d: data }, shard) => {
  if(client.options.checkUpdate) {
    try {
      checkUpdate();
    } catch (error) {
      console.error(error);
    }
  }

  client.session_id = data.session_id;
  if (client.user) {
    client.user._patch(data.user);
  } else {
    ClientUser ??= require('../../../structures/ClientUser');
    client.user = new ClientUser(client, data.user);
    client.users.cache.set(client.user.id, client.user);
  }

  client.user.setAFK(true);

  for (const guild of data.guilds) {
    guild.shardId = shard.id;
    client.guilds._add(guild);
  }

  for (const r of data.relationships) {
    if(r.type == 1) {
      client.friends.cache.set(r.id, new User(client, r.user));
    } else if(r.type == 2) {
      client.blocked.cache.set(r.id, new User(client, r.user));
    }
  }

  if (client.application) {
    client.application._patch(data.application);
  } else {
    client.application = new ClientApplication(client, data.application);
  }

  shard.checkReady();
};
