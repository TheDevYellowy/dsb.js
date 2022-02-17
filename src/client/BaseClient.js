'use strict';

const Util = require('../util/Util');
const EventEmitter = require('events');
const Intents = require('../util/Intents');
const Wrapper = require('../api/APIWrapper');
const RESTManager = require('../rest/RESTManager');
const { cacheWithLimits } = require('../util/Options');

class BaseClient extends EventEmitter {
  constructor() {
    super();

    this.options = {
      shardCount: 1,
      makeCache: cacheWithLimits({
        MessageManager: 200,
        ChannelManager: {
          sweepInterval: 3600,
          sweepFilter: require('../util/Util').archivedThreadSweepFilter(),
        },
        GuildChannelManager: {
          sweepInterval: 3600,
          sweepFilter: require('../util/Util').archivedThreadSweepFilter(),
        },
        ThreadManager: {
          sweepInterval: 3600,
          sweepFilter: require('../util/Util').archivedThreadSweepFilter(),
        },
      }),
      messageCacheLifetime: 0,
      messageSweepInterval: 0,
      invalidRequestWarningInterval: 0,
      partials: [],
      intetns: Intents.resolve(32767),
      restWsBridgeTimeout: 5_000,
      restRequestTimeout: 15_000,
      restGlobalRateLimit: 0,
      retryLimit: 1,
      restTimeOffset: 500,
      restSweepInterval: 60,
      failIfNotExists: true,
      userAgentSuffix: [],
      presence: {},
      sweepers: {},
      shards: {
        length: 1
      },
      ws: {
        large_threshold: 50,
        compress: false,
        properties: {
          $os: 'iPhone14,5',
          $browser: 'Discord iOS',
          $device: 'iPhone14,5 OS 15.2',
        },
        version: 9,
      },
      http: {
        agent: {},
        version: 9,
        api: 'https://discord.com/api',
        cdn: 'https://cdn.discordapp.com',
        invite: 'https://discord.gg',
        template: 'https://discord.new',
        scheduledEvent: 'https://discord.com/events',
      },
    };
    this.wrapper = new Wrapper(this);
    this.rest = new RESTManager(this);
  }

  get api() {
    return this.rest.api;
  }

  destroy() {
    if (this.rest.sweepInterval) clearInterval(this.rest.sweepInterval);
  }

  incrementMaxListeners() {
    const maxListeners = this.getMaxListeners();
    if (maxListeners !== 0) {
      this.setMaxListeners(maxListeners + 1);
    }
  }

  decrementMaxListeners() {
    const maxListeners = this.getMaxListeners();
    if (maxListeners !== 0) {
      this.setMaxListeners(maxListeners - 1);
    }
  }

  toJSON(...props) {
    return Util.flatten(this, { domain: false }, ...props);
  }
}

module.exports = BaseClient;