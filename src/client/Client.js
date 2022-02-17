'use strict';

const Endpoints = require('../api/Endpoints');
const { Collection } = require('@discordjs/collection');
const BaseClient = require('./BaseClient');
const ActionsManager = require('./actions/ActionsManager');
const ClientVoiceManager = require('./voice/ClientVoiceManager');
const WebSocketManager = require('./websocket/WebSocketManager');
const { Error, TypeError, RangeError } = require('../errors');
const BaseGuildEmojiManager = require('../managers/BaseGuildEmojiManager');
const ChannelManager = require('../managers/ChannelManager');
const GuildManager = require('../managers/GuildManager');
const UserManager = require('../managers/UserManager');
const ShardClientUtil = require('../sharding/ShardClientUtil');
const ClientPresence = require('../structures/ClientPresence');
const GuildPreview = require('../structures/GuildPreview');
const GuildTemplate = require('../structures/GuildTemplate');
const Invite = require('../structures/Invite');
const { Sticker } = require('../structures/Sticker');
const StickerPack = require('../structures/StickerPack');
const VoiceRegion = require('../structures/VoiceRegion');
const Webhook = require('../structures/Webhook');
const Widget = require('../structures/Widget');
const { Events, InviteScopes, Status } = require('../util/Constants');
const DataResolver = require('../util/DataResolver');
const Intents = require('../util/Intents');
const Options = require('../util/Options');
const Permissions = require('../util/Permissions');
const FriendsManager = require("../managers/FriendsManager");
const BlockedManager = require("../managers/BlockedManager");
const Sweepers = require('../util/Sweepers');


class Client extends BaseClient {
    constructor() {
        super();

        Object.defineProperty(this, 'token', { writable: true });
        if (!this.token && 'DISCORD_TOKEN' in process.env) {
            this.token = process.env.DISCORD_TOKEN;
        } else this.token = null;

        // I coded djs-selfbot things
        this.Endpoints = Endpoints;

        // normal d.js things
        this._cleanups = new Set();
        this._finalizers = new FinalizationRegistry(this._finalize.bind(this));
        this.ws = new WebSocketManager(this);
        this.actions = new ActionsManager(this);
        this.voice = new ClientVoiceManager(this);
        this.shard = null;
        // Managers
        this.users = new UserManager(this);
        this.friends = new FriendsManager(this);
        this.blocked = new BlockedManager(this);
        this.guilds = new GuildManager(this);
        this.channels = new ChannelManager(this);

        this.sweepers = new Sweepers(this, this.options.sweepers);
        this.presence = new ClientPresence(this, this.options.presence);

        this.user = null;
        this.application = null;
        this.readyAt = null;
    }

    /**
   * All custom emojis that the client has access to, mapped by their ids
   * @type {BaseGuildEmojiManager}
   * @readonly
   */
    get emojis() {
        const emojis = new BaseGuildEmojiManager(this);
        for (const guild of this.guilds.cache.values()) {
            if (guild.available) for (const emoji of guild.emojis.cache.values()) emojis.cache.set(emoji.id, emoji);
        }
        return emojis;
    }

    /**
     * Timestamp of the time the client was last `READY` at
     * @type {?number}
     * @readonly
     */
    get readyTimestamp() {
        return this.readyAt?.getTime() ?? null;
    }

    /**
     * How long it has been since the client last entered the `READY` state in milliseconds
     * @type {?number}
     * @readonly
     */
    get uptime() {
        return this.readyAt ? Date.now() - this.readyAt : null;
    }

    /**
     * Logs the client in, establishing a WebSocket connection to Discord.
     * @param {string} [token=this.token] Token of the account to log in with
     * @returns {Promise<string>} Token of the account used
     * @example
     * client.login('my token');
     */
    async login(token = this.token) {
        if (!token || typeof token !== 'string') throw new Error('TOKEN_INVALID');
        this.token = token = token.replace(/^(Bot|Bearer)\s*/i, '');
        this.emit(
            Events.DEBUG,
            `Provided token: ${token
                .split('.')
                .map((val, i) => (i > 1 ? val.replace(/./g, '*') : val))
                .join('.')}`,
        );

        if (this.options.presence) {
            this.options.ws.presence = this.presence._parse(this.options.presence);
        }

        this.emit(Events.DEBUG, 'Preparing to connect to the gateway...');

        try {
            await this.ws.connect();
            return this.token;
        } catch (error) {
            this.destroy();
            throw error;
        }
    }

    /**
     * Returns whether the client has logged in, indicative of being able to access
     * properties such as `user` and `application`.
     * @returns {boolean}
     */
    isReady() {
        return this.ws.status === Status.READY;
    }

    /**
     * Logs out, terminates the connection to Discord, and destroys the client.
     * @returns {void}
     */
    destroy() {
        super.destroy();

        for (const fn of this._cleanups) fn();
        this._cleanups.clear();

        if (this.sweepMessageInterval) clearInterval(this.sweepMessageInterval);

        this.sweepers.destroy();
        this.ws.destroy();
        this.token = null;
    }

    /**
     * Options used when fetching an invite from Discord.
     * @typedef {Object} ClientFetchInviteOptions
     * @property {Snowflake} [guildScheduledEventId] The id of the guild scheduled event to include with
     * the invite
     */

    /**
     * Obtains an invite from Discord.
     * @param {InviteResolvable} invite Invite code or URL
     * @param {ClientFetchInviteOptions} [options] Options for fetching the invite
     * @returns {Promise<Invite>}
     * @example
     * client.fetchInvite('https://discord.gg/djs')
     *   .then(invite => console.log(`Obtained invite with code: ${invite.code}`))
     *   .catch(console.error);
     */
    async fetchInvite(invite, options) {
        const code = DataResolver.resolveInviteCode(invite);
        const data = await this.wrapper.request('get', `/invites/${code}/`, true, {
            query: { with_counts: true, with_experation: true, guild_scheduled_event_id: options?.guildScheduledEventId },
        });
        return new Invite(this, data);
    }

    /**
     * Obtains a template from Discord.
     * @param {GuildTemplateResolvable} template Template code or URL
     * @returns {Promise<GuildTemplate>}
     * @example
     * client.fetchGuildTemplate('https://discord.new/FKvmczH2HyUf')
     *   .then(template => console.log(`Obtained template with code: ${template.code}`))
     *   .catch(console.error);
     */
    async fetchGuildTemplate(template) {
        const code = DataResolver.resolveGuildTemplateCode(template);
        const data = await this.wrapper.request('get', `/guilds/templates/${code}`);
        return new GuildTemplate(this, data);
    }

    /**
     * Obtains a webhook from Discord.
     * @param {Snowflake} id The webhook's id
     * @param {string} [token] Token for the webhook
     * @returns {Promise<Webhook>}
     * @example
     * client.fetchWebhook('id', 'token')
     *   .then(webhook => console.log(`Obtained webhook with name: ${webhook.name}`))
     *   .catch(console.error);
     */
    async fetchWebhook(id, token) {
        const data = await this.wrapper.request('get', `/webhooks/${id}/${token}`);
        return new Webhook(this, { token, ...data });
    }

    /**
     * Obtains the available voice regions from Discord.
     * @returns {Promise<Collection<string, VoiceRegion>>}
     * @example
     * client.fetchVoiceRegions()
     *   .then(regions => console.log(`Available regions are: ${regions.map(region => region.name).join(', ')}`))
     *   .catch(console.error);
     */
    async fetchVoiceRegions() {
        const apiRegions = await this.wrapper.request('get', '/voice/regions', true);
        const regions = new Collection();
        for (const region of apiRegions) regions.set(region.id, new VoiceRegion(region));
        return regions;
    }

    /**
     * Obtains a sticker from Discord.
     * @param {Snowflake} id The sticker's id
     * @returns {Promise<Sticker>}
     * @example
     * client.fetchSticker('id')
     *   .then(sticker => console.log(`Obtained sticker with name: ${sticker.name}`))
     *   .catch(console.error);
     */
    async fetchSticker(id) {
        const data = await this.wrapper.request('get', `/stickers/${id}`, true);
        return new Sticker(this, data);
    }

    /**
     * Obtains the list of sticker packs available to Nitro subscribers from Discord.
     * @returns {Promise<Collection<Snowflake, StickerPack>>}
     * @example
     * client.fetchPremiumStickerPacks()
     *   .then(packs => console.log(`Available sticker packs are: ${packs.map(pack => pack.name).join(', ')}`))
     *   .catch(console.error);
     */
    async fetchPremiumStickerPacks() {
        const data = await this.wrapper.request('get', '/sticker-packs', true);
        return new Collection(data.sticker_packs.map(p => [p.id, new StickerPack(this, p)]));
    }
    /**
     * A last ditch cleanup function for garbage collection.
     * @param {Function} options.cleanup The function called to GC
     * @param {string} [options.message] The message to send after a successful GC
     * @param {string} [options.name] The name of the item being GCed
     * @private
     */
    _finalize({ cleanup, message, name }) {
        try {
            cleanup();
            this._cleanups.delete(cleanup);
            if (message) {
                this.emit(Events.DEBUG, message);
            }
        } catch {
            this.emit(Events.DEBUG, `Garbage collection failed on ${name ?? 'an unknown item'}.`);
        }
    }

    /**
     * Sweeps all text-based channels' messages and removes the ones older than the max message lifetime.
     * If the message has been edited, the time of the edit is used rather than the time of the original message.
     * @param {number} [lifetime=this.options.messageCacheLifetime] Messages that are older than this (in seconds)
     * will be removed from the caches. The default is based on {@link ClientOptions#messageCacheLifetime}
     * @returns {number} Amount of messages that were removed from the caches,
     * or -1 if the message cache lifetime is unlimited
     * @example
     * // Remove all messages older than 1800 seconds from the messages cache
     * const amount = client.sweepMessages(1800);
     * console.log(`Successfully removed ${amount} messages from the cache.`);
     */
    sweepMessages(lifetime = this.options.messageCacheLifetime) {
        if (typeof lifetime !== 'number' || isNaN(lifetime)) {
            throw new TypeError('INVALID_TYPE', 'lifetime', 'number');
        }
        if (lifetime <= 0) {
            this.emit(Events.DEBUG, "Didn't sweep messages - lifetime is unlimited");
            return -1;
        }

        const messages = this.sweepers.sweepMessages(Sweepers.outdatedMessageSweepFilter(lifetime)());
        this.emit(Events.DEBUG, `Swept ${messages} messages older than ${lifetime} seconds`);
        return messages;
    }

    /**
     * Obtains a guild preview from Discord, available for all guilds the bot is in and all Discoverable guilds.
     * @param {GuildResolvable} guild The guild to fetch the preview for
     * @returns {Promise<GuildPreview>}
     */
    async fetchGuildPreview(guild) {
        const id = this.guilds.resolveId(guild);
        if (!id) throw new TypeError('INVALID_TYPE', 'guild', 'GuildResolvable');
        const data = await this.wrapper.request('get', this.Endpoints.guild.preview(id), true);
        return new GuildPreview(this, data);
    }

    /**
     * Obtains the widget data of a guild from Discord, available for guilds with the widget enabled.
     * @param {GuildResolvable} guild The guild to fetch the widget data for
     * @returns {Promise<Widget>}
     */
    async fetchGuildWidget(guild) {
        const id = this.guilds.resolveId(guild);
        if (!id) throw new TypeError('INVALID_TYPE', 'guild', 'GuildResolvable');
        const data = await this.wrapper.request('get', this.Endpoints.guild.widget(id), true);
        return new Widget(this, data);
    }

    toJSON() {
        return super.toJSON({
            readyAt: false,
        });
    }

    /**
     * Calls {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/eval} on a script
     * with the client as `this`.
     * @param {string} script Script to eval
     * @returns {*}
     * @private
     */
    _eval(script) {
        return eval(script);
    }
}

module.exports = Client;
