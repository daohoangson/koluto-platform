var documentModel = require('../model/document.js');

exports['test DocumentModel#parseText/simple'] = function(beforeEnd, assert) {
    var tokens = documentModel.parseText('hello world', {ignoredList:[]});
    assert.equal(2, tokens.length);
}

exports['test DocumentModel#parseText/longer'] = function(beforeEnd, assert) {
    var tokens = documentModel.parseText('      giáo sư (gs), cảnh báo... trường đại học :( a b c d â đ ô ì!!!   ', {ignoredList:[]});
    assert.equal(8, tokens.length);
}

exports['test DocumentModel#parseText/vietnamese cases'] = function(beforeEnd, assert) {
    var tokens = documentModel.parseText('Thử nghiệm với TIẾNG VIỆT VIẾT HOA. Đàn bò con trâu!', {ignoredList:[]});
    assert.equal(11, tokens.length);
    assert.equal('tiếng', tokens[3]);
    assert.equal('việt', tokens[4]);
    assert.equal('viết', tokens[5]);
    assert.equal('đàn', tokens[7]);
}

exports['test DocumentModel#parseText/merge2'] = function(beforeEnd, assert) {
    var tokens = documentModel.parseText('hello world', { maxTokensToMerge: 2, ignoredList:[] });
    assert.equal(3, tokens.length);
}

exports['test DocumentModel#parseText/merge2 longer'] = function(beforeEnd, assert) {
    var tokens = documentModel.parseText('Lorem    ipsum     dolor    sit     amet,     consectetur    adipiscing     elit    . Pellentesque     neque    arcu   ,        interdum ut ullamcorper et, pharetra vel lorem', { maxTokensToMerge: 2, ignoredList:[] });
    assert.equal(31, tokens.length);
}

exports['test DocumentModel#parseText/merge3'] = function(beforeEnd, assert) {
    var tokens = documentModel.parseText('hello world', { maxTokensToMerge: 3, ignoredList:[] });
    assert.equal(3, tokens.length);
}

exports['test DocumentModel#parseText/merge3 longer'] = function(beforeEnd, assert) {
    var tokens = documentModel.parseText('Lorem    ipsum     dolor    sit     amet,     consectetur    adipiscing     elit    . Pellentesque     neque    arcu   ,        interdum ut ullamcorper et, pharetra vel lorem', { maxTokensToMerge: 3, ignoredList:[] });
    assert.equal(39, tokens.length);
}

exports['test DocumentModel#parseText/mixed'] = function(beforeEnd, assert) {
    var tokens = documentModel.parseText('hello world123 abc123def 123xyz', { ignoredList:[] });
    assert.equal(1, tokens.length);
}