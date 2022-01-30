'use strict';

const EventEmitter = require('node:events');
const Wrapper = require('../api/APIWrapper');
const RESTManager = require('../rest/RESTManager');

class BaseClient extends EventEmitter {
    constructor() {
        super();

        this.options = {
            shardCount: 1,
            messageCacheLifetime: 0,
            messageSweepInterval: 0,
            invalidRequestWarningInterval: 0,
            partials: [],
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
}

module.exports = BaseClient;