const isObject = d => typeof d === 'object' && d !== null;
const { Collection } = require('@discordjs/collection')

class Util extends null {
    static flatten(obj, ...props) {
        if (!isObject(obj)) return obj

        const objProps = Object.keys(obj)
            .filter(k => !k.startsWith('_'))
            .map(k => ({ [k]: true }));

        props = objProps.length ? Object.assign(...objProps, ...props) : Object.assign({}, ...props);

        const out = {};

        for (let [prop, newProp] of Object.entries(props)) {
            if(!newProp) continue;
            newProp = newProp === true ? prop : newProp;

            const element = obj[prop];
            const elemIsObj = isObject(element);
            const valueOf = elemIsObj && typeof element.valueOf === 'function' ? element.valueOf() : null;

            if(element instanceof Collection) out[newProp] = Array.from(element.keys());
            else if(valueOf instanceof Collection) out[newProp] = Array.from(valueOf.keys());
            else if(Array.isArray(element)) out[newProp] = element.map(e => Util.flatten(e));
            else if(typeof valueOf !== 'object') out[newProp] = valueOf;
            else if(!elemIsObj) out[newProp] = element;
        }

        return out;
    }
}

module.exports = Util;