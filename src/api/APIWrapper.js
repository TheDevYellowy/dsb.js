const HTTPS = require('https');
const { headers } = require('../util/Constants');
const Endpoints = require('./Endpoints');
const MultipartData = require('../util/MultipartData');
const DiscordRESTError = require('../util/DiscordRESTError');
const DiscordHTTPError = require('../util/DiscordHTTPError');
const SequentialBucket = require('../util/SequentialBucket');
const zlib = require('zlib');

/**
 * This Wrapper is basically copied from eris you can check out the github here https://github.com/abalabahaha/eris
 */

class Wrapper {
    constructor(client) {
        this._client = client;
        this.ratelimits = {};
        this.latencyRef = {
            latency: 0,
            raw: new Array(10).fill(0),
            timeOffset: this._client.options.restTimeOffset,
            timeOffsets: new Array(10).fill(0),
            lastTimeOffsetCheck: 0
        }
        this.globalBlock = false;
        this.readyQueue = [];
    }

    globalUnblock() {
        this.globalBlock = false;
        while(this.readyQueue.length > 0) {
            this.readyQueue.shift()();
        }
    }

    /**
     * Make an API request
     * @arg {String} method HTTP method
     * @arg {String} url URL of the endpoint
     * @arg {Boolean} [auth] Whether to add the Authorization header and token
     * @arg {Object} [body] Request payload 
     * @arg {Object} [file] File Object
     * @arg {Buffer} file.file A buffer containing file data
     * @arg {String} file.name What to name the file
     * @returns {Promise<Object>} Resolve with the returned JSON data
     */
    async request(method, url, auth, body, file, short) {
        var route = this.routefy(url, method);
        method = method.toUpperCase();
        const _stackHolder = {};

        return new Promise((resolve, reject) => {
            let attempts = 0;

            const actualCall = (cb) => {
                let data;
                let finalURL = url;

                try {
                    if(auth) headers.Authorization = this._client.token;
                    if(body && body.reason) {
                        let unencodedReason = body.reason;
                        if(unencodedReason.includes('%') && !unencodedReason.includes(' ')) unencodedReason = decodeURIComponent(unencodedReason);
                        headers['X-Audit-Log-Reason'] = encodeURIComponent(unencodedReason)
                        if((method === 'PUT' || !url.includes('/bans')) && (method !== 'POST' || !url.includes('/prune'))) delete body.reason;
                        else body.reason = unencodedReason;
                    }

                    if(file) {} // Figure out some stuff and add later
                    else if(body) {
                        if(method === 'GET' || method === 'DELETE') {
                            let qs = '';
                            Object.keys(body).forEach(function(key) {
                                if(body[key] != undefined) {
                                    if(Array.isArray(body[key])) {
                                        body[key].forEach(function(val) {
                                            qs += `&${encodeURIComponent(key)}=${encodeURIComponent(val)}`;
                                        })
                                    } else {
                                        qs += `&${encodeURIComponent(key)}=${encodeURIComponent(body[key])}`
                                    }
                                }
                            });

                            finalURL += `?${qs.substring(1)}`;
                        } else {
                            data = JSON.stringify(body, (k, v) => typeof v === 'bigint' ? v.toString() : v);
                        }
                    }
                } catch(err) {
                    cb();
                    reject(err);
                    return;
                }

                let req;

                try {
                    req = HTTPS.request({
                        method: method,
                        host: Endpoints.client_url,
                        path: Endpoints.base_url + finalURL,
                        headers: headers
                    });
                } catch (err) {
                    cb();
                    reject(err);
                    return;
                }

                let reqErr;

                req.once('abort', () => {
                    cb();
                    reqErr = reqErr || new Error(`Request aborted by client on ${method} ${url}`);
                    reqErr.req = req;
                    reject(reqErr);
                }).once('error', (err) => {
                    reqErr = err;
                    req.abort();
                });

                let latency = Date.now();

                req.once('response', (res) => {
                    latency = latency - Date.now();
                    if(this._client.listeners('rawREST').length) {
                        this._client.emit('rawREST', {method, url, auth, body, file, route, res, short, latency});
                    }

                    const headerNow = Date.parse(res.headers['date']);

                    res.once('aborted', () => {
                        cb();
                        reqErr = reqErr || new Error(`Request aborted by server on ${method} ${url}`);
                        reqErr.req = req;
                        reject(reqErr)
                    })

                    let response = '';

                    let _resStream = res;
                    if(res.headers['content-encoding']) {
                        if(res.headers['content-encoding'].includes('gzip')) _resStream = res.pipe(zlib.createGunzip());
                        else if(res.headers['content-encoding'].includes('deflate')) _resStream = res.pipe(zlib.createInflate());
                    }

                    _resStream.on('data', (str) => {
                        response += str;
                    }).on('error', err => {
                        reqErr = err;
                        req.abort();
                    }).once('end', () => {
                        const now = Date.now();

                        if(res.headers['x-ratelimit-limit']) this.ratelimits[route].limit = +res.headers['x-ratelimit-limit'];

                        if(method !== "GET" && (res.headers["x-ratelimit-remaining"] == undefined || res.headers["x-ratelimit-limit"] == undefined) && this.ratelimits[route].limit !== 1) {
                            this._client.emit("debug", `Missing ratelimit headers for SequentialBucket(${this.ratelimits[route].remaining}/${this.ratelimits[route].limit}) with non-default limit\n`
                                + `${res.statusCode} ${res.headers["content-type"]}: ${method} ${route} | ${res.headers["cf-ray"]}\n`
                                + "content-type = " +  + "\n"
                                + "x-ratelimit-remaining = " + res.headers["x-ratelimit-remaining"] + "\n"
                                + "x-ratelimit-limit = " + res.headers["x-ratelimit-limit"] + "\n"
                                + "x-ratelimit-reset = " + res.headers["x-ratelimit-reset"] + "\n"
                                + "x-ratelimit-global = " + res.headers["x-ratelimit-global"]);
                        }

                        this.ratelimits[route].remaining = res.headers['x-ratelimit-remaining'] === undefined ? 1 : +res.headers['x-ratelimit-remaining'] || 0;
                        const retryAfter = parseInt(res.headers["x-ratelimit-reset-after"] || res.headers["retry-after"]) * 1000;

                        if(retryAfter>=0) {
                            if(res.headers['x-ratelimit-global']) {
                                this.globalBlock = true;
                                setTimeout(() => this.globalUnblock(), retryAfter || 1);
                            } else {
                                this.ratelimits[route].reset = (retryAfter || 1) + now;
                            }
                        } else if(res.headers['x-ratelimit-reset']) {
                            let resetTime = +res.headers['x-ratelimit-reset'] * 1000;
                            if(route.endsWith('/reactions/:id') && (+res.headers['x-ratelimit-reset'] * 1000 - headerNow) === 1000) {
                                resetTime = now+250;
                            }
                            this.ratelimits[route].reset = Math.max(resetTime - this.latencyRef.latency, now);
                        } else this.ratelimits[route].reset = now;

                        if(res.statusCode !== 429) {
                            const content = typeof body === 'object' ? `${body.content} ` : '';
                            this._client.emit('debug', `${content}${now} ${route} ${res.statusCode}: ${latency}ms (${this.latencyRef.latency}ms avg) | ${this.ratelimits[route].remaining}/${this.ratelimits[route].limit} left | Reset ${this.ratelimits[route].reset} (${this.ratelimits[route].reset - now}ms left)`);
                        }

                        if(res.statusCode >= 300) {
                            if(res.statusCode === 429) {
                                const content = typeof body === "object" ? `${body.content} ` : "";
                                this._client.emit("debug", `${res.headers["x-ratelimit-global"] ? "Global" : "Unexpected"} 429 (╯°□°）╯︵ ┻━┻: ${response}\n${content} ${now} ${route} ${res.statusCode}: ${latency}ms (${this.latencyRef.latency}ms avg) | ${this.ratelimits[route].remaining}/${this.ratelimits[route].limit} left | Reset ${this.ratelimits[route].reset} (${this.ratelimits[route].reset - now}ms left)`);
                                if(retryAfter) {
                                    setTimeout(() => {
                                        cb();
                                        this.request(method, url, auth, body, file, route, true).then(resolve).catch(reject);
                                    }, retryAfter);
                                    return;
                                } else {
                                    cb();
                                    this.request(method, url, auth, body, file, route, true).then(resolve).catch(reject);
                                    return;
                                }
                            } else if(res.statusCode === 502 && ++attempts < 4) {
                                this._client.emit("debug", "A wild 502 appeared! Thanks CloudFlare!");
                                setTimeout(() => {
                                    this.request(method, url, auth, body, file, route, true).then(resolve).catch(reject);
                                }, Math.floor(Math.random() * 1900 + 100));
                                return cb();
                            }
                            cb();

                            if(response.length > 0) {
                                if(res.headers["content-type"] === "application/json") {
                                    try {
                                        response = JSON.parse(response);
                                    } catch(err) {
                                        reject(err);
                                        return;
                                    }
                                }
                            }

                            let {stack} = _stackHolder;
                            if(stack.startsWith("Error\n")) {
                                stack = stack.substring(6);
                            }
                            let err;
                            if(response.code) {
                                err = new DiscordRESTError(req, res, response, stack);
                            } else {
                                err = new DiscordHTTPError(req, res, response, stack);
                            }
                            reject(err);
                            return;
                        }

                        if(response.length > 0) {
                            if(res.headers['content-type'] === 'application/json') {
                                try {
                                    response = JSON.parse(response);
                                } catch (err) {
                                    cb();
                                    reject(err)
                                    return;
                                }
                            }
                        }

                        cb();
                        resolve(response);
                    });
                });

                req.setTimeout(15000, () => {
                    reqErr = new Error(`Request timed out (>15000ms) on ${method} ${url}`);
                    req.abort();
                })

                if(Array.isArray(data)) {
                    for(const chunk of data) req.write(chunk);
                    req.end();
                } else req.end(data);
            };

            if(this.globalBlock && auth) {
                this.readyQueue.push(() => {
                    if(!this.ratelimits[route]) this.ratelimits[route] = new SequentialBucket(1, this.latencyRef);
                    this.ratelimits[route].queue(actualCall, short);
                })
            } else {
                if(!this.ratelimits[route]) this.ratelimits[route] = new SequentialBucket(1, this.latencyRef);
                this.ratelimits[route].queue(actualCall, short);
            }
        });
    }

    routefy(url, method) {
        let route = url.replace(/\/([a-z-]+)\/(?:[0-9{17,19}])/g, function(match, p) {
            return p === 'channels' || p=== 'guilds' || p === 'webhooks' ? match : `/${p}/:id`;
        }).replace(/\/reactions\/[^/]+/g, "/reactions/:id").replace(/\/reactions\/:id\/[^/]+/g, "/reactions/:id/:userID").replace(/^\/webhooks\/(\d+)\/[A-Za-z0-9-_]{64,}/, "/webhooks/$1/:token");
        method = method.toUpperCase();
        if(method === 'DELETE' && route.endsWith('/messages/:id')){

        } else if(method === 'GET' && /\/guilds\/[0-9]+\/channels$/.test(route)) {
            route = '/guilds/:id/channels'
        }
        if(method === 'PUT' || method === 'DELETE') {
            const index = route.indexOf('/reactions')
            if(index !== -1) {
                route = 'MODIFY' + route.slice(0, index+10);
            }
        }

        return route;
    }

    toString() {
        return '[APIWrapper]'
    }
}

module.exports = Wrapper;