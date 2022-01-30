'use strict';

const BaseClient = require('./BaseClient');


class Client extends BaseClient {
    constructor() {
        super();

        const data = require('node:worker_threads').workerData ?? process.env;

        Object.defineProperty(this, 'token', {writable: true });
        if(!this.token && 'DISCORD_TOKEN' in process.env) {
            this.token = process.env.DISCORD_TOKEN;
        } else this.token = null;


    }
}

module.exports = Client;
