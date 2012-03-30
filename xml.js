var stringify = function(data, dataKey, notRoot) {
    var xml = '';

    if (data === null) {
        xml = 'null';
    } else if (data === true) {
        xml = 'true';
    } else if (data === false) {
        xml = 'false';
    } else if (typeof data == 'object') {
        if (typeof data.length !== 'undefined') {
            // this is an array
            var itemKey = 'item';
            
            if (typeof dataKey == 'string' && dataKey[dataKey.length - 1] == 's') {
                // key contains 's' as the last character
                // try to be smart here
                itemKey = dataKey.substr(0, dataKey.length - 1);
            }
            
            for (var key in data) {
                xml += '<' + itemKey + '>';
                
                children = stringify(data[key], key, true);
                xml += children;
                
                xml += '</' + itemKey + '>';
            }
        } else {
            // this is an object
            var hasFunction = false;
            for (var key in data) {
                if (typeof data[key] == 'function') {
                    hasFunction = true;
                    break;
                }
            }
            
            if (hasFunction) {
                // object with functions, treat it as string
                xml = data;
            } else {
                // object with keys and values only, go through them
                for (var key in data) {
                    xml += '<' + key + '>';

                    children = stringify(data[key], key, true);
                    xml += children;

                    xml += '</' + key + '>';
                }
            }
        }
    }
    
    if (xml == '') {
        // couldn't parse it before?
        // treat it as string...
        xml += data;
    }
    
    if (!notRoot) {
        xml = '<?xml version="1.0"?>' + xml;
    }
    
    return xml;
}

exports.stringify = stringify;