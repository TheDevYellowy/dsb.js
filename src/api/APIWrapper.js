const request = require('node-fetch');
const {} = require('../util/Constants');

class Wrapper {
    constructor(client) {
        super(client);
    }

    sendRequest(method, url, body=null, timeout=null) {
        if(['get', 'post', 'patch', 'delete'].includes(method)) {
            var data = {};
            if(body !== null) {
                if(typeof body == 'object') {
                    data = {'data': JSON.stringify(body)}
                } else {
                    data = {'data': body}
                }
            }

            if(timeout == null) data['timeout'] = timeout;
            
        }
    }

    get user(userid) {
        const get = async () => {

        }
    }
}

module.exports = Wrapper;