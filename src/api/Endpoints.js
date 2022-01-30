const {v} = require('../util/Constants');

exports.base_url = `/api/v${v}`;
exports.cdn_url = 'https://cdn.discordapp.com';
exports.client_url = 'https://discord.com';

exports.client = {
    client_relationships = () => `/users/@me/relationships`,
}

exports.user = {
    mutual_friends = (id) => `/users/${id}/relationships`,
    user_relationship = (uID, rID) => `/users/${uID}/relationships/${rID}`,

}

exports.guild = {
    
}

exports.channel = {

}

exports.message = {
    add_reaction = (cID, mID, reaction) => `/channels/${cID}/messages/${mID}/reactions/${reaction}/@me`,
}