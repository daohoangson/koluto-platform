var documentModel = exports;
var _ = require('underscore')._;
var vietntl = require('vietntl');
var tokenizer = new vietntl.Tokenizer();

documentModel.parseText = function(text, options) {
    defaultOptions = {
         // this will set how tokens are merged together
         // with a value larger than 1, tokens will be merged
         // otherwise, the token list will be kept as is
        maxTokensToMerge: 1,
        
        // this will only return merged token (original tokens will be ignored)
        keepMergedOnly: false,
        
        // tokens that exists in the list will be removed 
        // from final result
        ignoredList: [
            'của', 'là', 'và', 'có', 'được', 'người', 'đã', 'không', 'trong',
            'cho', 'những', 'các', 'với', 'này', 'để', 'ông', 'ra', 'khi', 'lại',
            'đến', 'về', 'nhà', 'vào', 'cũng', 'làm', 'từ', 'đó', 'như', 'nhiều',
            'sau', 'bị', 'tại', 'anh', 'phải', 'con', 'sự',
            'tôi', 'việc', 'thì', 'chỉ', 'trên',
            'còn', 'mà', 'thế', 'ngày', 'đi', 'nhưng', 'hiện',
            'hàng', 'nhất', 'số', 'điều', 'bộ', 'theo', 'sẽ', 'vụ', 'bà',
            'đang', 'cả', 'biết', 'mình', 'trước', 'vì', 'chị',
            'rất', 'lên', 'rằng', 'nói', 'hơn', 'một', 'khác', 'chúng',
            'đây'
        ],
        
        // remove single character tokens or not?
        filterSingleCharacterTokens: true,
    };
    var options = options || {};
    _.defaults(options, defaultOptions);
    
    // convert to lowercase
    text = text.toLowerCase();
    // replace multiple spaces with one space
    text = text.replace(/\s+/g, ' ');
    
    var tokens = tokenizer.tokenize(text);
    
    // filter out single character tokens
    if (options.filterSingleCharacterTokens) {
        tokens = _.filter(tokens, function(token) { return token.length > 1; });
    }
    
    // filter out ignored tokens
    if (options.ignoredList.length > 0) {
        tokens = _.difference(tokens, options.ignoredList);
    }
    
    // merge tokens to form new tokens
    if (options.maxTokensToMerge > 1) {
        newTokens = documentModel._mergeTokens(text, tokens, options.maxTokensToMerge);
        
        if (options.keepMergedOnly) {
            // ignore original tokens
            tokens = newTokens;
        } else {
            tokens = tokens.concat(newTokens);
        }
        
        // filter out ignored tokens
        // do it again with merged tokens, just to be sure
        if (options.ignoredList.length > 0) {
            tokens = _.difference(tokens, options.ignoredList);
        }
    }
    
    return tokens
};

documentModel._mergeTokens = function(text, tokens, max) {
    var newTokens = [];
    var previous = [];
    
    _.each(tokens, function(token) {
        if (previous.length == 0) {
            // nothing to do yet
        } else {
            // start merging this token
            // with previous tokens
            for (var i = 0; i < previous.length; i++) {
                var tmp = previous.slice(i);
                tmp.push(token);
                tmp = tmp.join(' ');
                
                // check for the joined token
                // to make sure it exists in the text
                // 'exists' means there is only spaces (ASCII 32)
                // between the original tokens
                if (text.indexOf(tmp) != -1) {
                    newTokens.push(tmp);
                }
            }
        }
        
        // keep this token in the previous array
        // to merge it later
        previous.push(token);
        
        if (previous.length >= max) {
            // too many token in the previous array
            // remove the oldest one
            previous.shift();
        }
    });
    
    return newTokens;
}