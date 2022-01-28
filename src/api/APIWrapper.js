const request = require('node-fetch');
const { headers } = require('../util/Constants');

class Wrapper {
    constructor(client) {
        super(client);
    }

    sendRequest(method, url, body=null, timeout=null) {
        if(['get', 'post', 'patch', 'delete'].includes(method)) {
            var data = {};
            if(body !== null) {
                if(typeof body == 'object') {
                    data = JSON.stringify(body)
                } else {
                    data = body
                }
            }

            if(timeout == null) data['timeout'] = timeout;
            const res = await reques(`https://discord.com/api/v9/${url}`, {
							method: method,
							body: data,
							headers: headers
						})

						if(res) return res.json();
						
        }
    }

    get user(userid) {
        const get = async () => {

        }
    }
}

module.exports = Wrapper;