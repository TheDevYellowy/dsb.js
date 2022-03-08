'use strict';

const EventEmitter = require('node:events');
const RESTManager = require('../rest/RESTManager');
const { TypeError } = require('../errors');
const Options = require('../util/Options');
const Util = require('../util/Util');

/**
 * The base class for all clients.
 * @extends {EventEmitter}
 */
class BaseClient extends EventEmitter {
  constructor(options = {}) {
    super({ captureRejections: true });

    if (typeof options !== 'object' || options === null) {
      throw new TypeError('INVALID_TYPE', 'options', 'object', true);
    }

    /**
     * The options the client was instantiated with
     * @type {ClientOptions}
     */
    this.options = Util.mergeDefault(Options.createDefault(), options);

    /**
     * The REST manager of the client
     * @type {REST}
     */
    this.rest = new RESTManager(this.options.rest);
  }

  get api() {
    return this.rest.api;
  }

  /**
   * Destroys all assets used by the base client.
   * @returns {void}
   */
  destroy() {
    if(this.rest.sweepInterval) clearInterval(this.rest.sweepInterval);
  }

  /**
   * Increments max listeners by one, if they are not zero.
   * @private
   */
  incrementMaxListeners() {
    const maxListeners = this.getMaxListeners();
    if (maxListeners !== 0) {
      this.setMaxListeners(maxListeners + 1);
    }
  }

  /**
   * Decrements max listeners by one, if they are not zero.
   * @private
   */
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

/**
 * @external REST
 * @see {@link https://discord.js.org/#/docs/rest/main/class/REST}
 */
