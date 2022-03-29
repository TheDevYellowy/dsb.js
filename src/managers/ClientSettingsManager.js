'use strict';

const { remove } = require('lodash');
const CachedManager = require("./CachedManager");
const { Error, TypeError } = require('../errors/DJSError');
const { default: Collection } = require('@discordjs/collection');

const localeObject = {
    DANISH: 'da',
    GERMAN: 'de',
    ENGLISH_UK: 'en-GB',
    ENGLISH_US: 'en-US',
    SPANISH: 'es-ES',
    FRENCH: 'fr',
    CROATIAN: 'hr',
    ITALIAN: 'it',
    LITHUANIAN: 'lt',
    HUNGARIAN: 'hu',
    DUTCH: 'nl',
    NORWEGIAN: 'no',
    POLISH: 'pl',
    BRAZILIAN_PORTUGUESE: 'pt-BR',
    ROMANIA_ROMANIAN: 'ro',
    FINNISH: 'fi',
    SWEDISH: 'sv-SE',
    VIETNAMESE: 'vi',
    TURKISH: 'tr',
    CZECH: 'cs',
    GREEK: 'el',
    BULGARIAN: 'bg',
    RUSSIAN: 'ru',
    UKRAINIAN: 'uk',
    HINDI: 'hi',
    THAI: 'th',
    CHINA_CHINESE: 'zh-CN',
    JAPANESE: 'ja',
    TAIWAN_CHINESE: 'zh-TW',
    KOREAN: 'ko',
};

class ClientSettingsManager extends CachedManager {
    constructor(client, iterable) {
        super(client);
        // Raw settings json
        this.rawSettings = {};

        // everything from the raw json put neatly
        this.locale = null;
        this.showCurrentGame = null;
        this.autoplayGIF = null;
        this.compactMode = null;
        this.convertEmoji = null;
        this.allowTTS = null;
        this.theme = null;
        this.animatedEmojis = null;
        this.showReactions = null;
        this.customStatus = null; // Not working!!!
        this.guildMetadata = new Collection();
    }

    /**
     * @param {Object} data Raw settings data
     * @private
     */
    _patch(data) {
        this.rawSettings = data;
        if ('locale' in data) {
            this.locale = data.locale;
        }
        if ('show_current_game' in data) {
            this.showCurrentGame = data.show_current_game;
        }
        if ('gif_auto_play' in data) {
            this.autoplayGIF = data.gif_auto_play;
        }
        if ('message_display_compact' in data) {
            this.compactMode = data.message_display_compact;
        }
        if ('convert_emoticons' in data) {
            this.convertEmoji = data.convert_emoticons;
        }
        if ('enable_tts_command' in data) {
            this.allowTTS = data.enable_tts_command;
        }
        if ('theme' in data) {
            this.theme = data.theme;
        }
        if ('animate_emoji' in data) {
            this.animatedEmojis = data.animate_emoji;
        }
        if ('render_reactions' in data) {
            this.showReactions = data.render_reactions;
        }
        if ('custom_status' in data) {
            this.customStatus = data.custom_status || {};
            this.customStatus.status = data.status;
        }
        if ('guild_folders' in data) {
            const data_ = data.guild_positions.map((guildId, i) => {
                // Find folder
                const folderIndex = data.guild_folders.findIndex((obj) =>
                    obj.guild_ids.includes(guildId),
                );
                const metadata = {
                    guildId: guildId,
                    guildIndex: i,
                    folderId: data.guild_folders[folderIndex]?.id,
                    folderIndex,
                    folderName: data.guild_folders[folderIndex]?.name,
                    folderColor: data.guild_folders[folderIndex]?.color,
                    folderGuilds: data.guild_folders[folderIndex]?.guild_ids,
                };
                return [guildId, metadata];
            });
            this.guildMetadata = new Collection(data_);
        }
    }

    async fetch() {
        if (this.client.bot) throw new Error('INVALID_BOT_METHOD');
        try {
            const data = await this.client.api.users('@me').settings.get();
            this._patch(data);
            return this;
        } catch (e) {
            throw e;
        }
    }

    async edit(data) {
        if (this.client.bot) throw new Error('INVALID_BOT_METHOD');
        try {
            const res = await this.client.api.users('@me').settings.patch({ data });
            this._patch(res);
            return this;
        } catch (e) {
            throw e;
        }
    }

    /**
     * Set Compact Mode
     * @param {Boolean} bool Whether to enable or disable compact mode
     * @returns {Boolean}
     */
    async setCompactMode(bool) {
        if (this.client.bot) throw new Error('INVALID_BOT_METHOD');
        if (!['boolean'].includes(typeof bool)) throw new TypeError('INVALID_TYPE', 'bool', 'boolean', true);
        if (!bool) bool = !this.compactMode;
        if (bool !== this.compactMode) await this.edit({ message_display_compact: bool });
        return this.compactMode
    }

    /**
     * Discord Client Theme
     * @param {'dark' | 'light'} str Theme to set
     */
    async setTheme(str) {
        if (this.client.bot) throw new Error('INVALID_BOT_METHOD');
        const values = ['light', 'dark'];

        if (typeof str !== 'string') throw new TypeError('INVALID_TYPE', 'str', 'string', true);
        if (!values.includes(str)) str == values[0] ? (str = values[0]) : (str = values[1]);
        if(str !== this.theme) await this.edit({ theme: str });
        return this.theme;
    }

    /**
     * sets the clients locale
     * @param {localeObject} value 
     * @returns {locale}
     */
    async setLocale(value) {
		if (this.client.bot) throw new Error('INVALID_BOT_METHOD');
		if (typeof value !== 'string')
			throw new TypeError('INVALID_TYPE', 'value', 'string', true);
		if (!localeObject[value]) throw new Error('INVALID_LOCALE');
		if (localeObject[value] !== this.locale) {
			await this.edit({ locale: localeObject[value] });
		}
		return this.locale;
	}
}

module.exports = ClientSettingsManager;