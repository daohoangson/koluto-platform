var documentModel = require('../model/document.js');

exports['test DocumentModel#parseText/simple'] = function(beforeEnd, assert) {
    var tokens = documentModel.parseText('hello world', {ignoredList:[]});
    assert.equal(2, tokens.length);
}

exports['test DocumentModel#parseText/longer'] = function(beforeEnd, assert) {
    var tokens = documentModel.parseText('      giáo sư (gs), cảnh báo... trường đại học :( a b c d â đ ô ì!!!   ', {ignoredList:[]});
    assert.equal(16, tokens.length);
}

exports['test DocumentModel#parseText/vietnamese cases'] = function(beforeEnd, assert) {
    var tokens = documentModel.parseText('Thử nghiệm với TIẾNG VIỆT VIẾT HOA. Đàn bò con trâu!', {ignoredList:[]});
    assert.equal(8, tokens.length);
    assert.includes(tokens, 'tiếng việt viết hoa');
    assert.includes(tokens, 'đàn');
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

exports['test DocumentModel#parseText/smart'] = function(beforeEnd, assert) {
    var tokens = documentModel.parseText('Các vụ ngộ độc do sử dụng các chất phụ gia gây ra có chiều hướng gia \
    tăng. Bộ Y tế cho biết, tình trạng vi phạm khi cố tình sử dụng phụ gia không thuộc danh mục còn diễn ra khá \
    phổ biến. Tại các tỉnh phía bắc, nhiều mẫu thực phẩm có chứa Rhodamine B với hàm lượng cao; nhiều mẫu thực phẩm\
    sử dụng Ni-trit (trong xúc-xích, giăm-bông), phẩm mầu có chứa kiềm (trong nước giải khát, mì ăn  liền);  vẫn  \
    còn 15,6% mẫu bún, bánh phở, bánh giò, bánh su-sê có sử dụng hàn the... Còn tại các tỉnh phía nam, qua kiểm tra\
    có tới 298 trong tổng số 437 mẫu sản phẩm là mì sợi tươi, thực phẩm chay dương tính với formol; 86 trong số \
    115 mẫu hoa chuối, bẹ chuối, măng chua dương tính với chất tẩy trắng; 28 trong số 52 mẫu tôm khô, hạt dưa, mứt.\
    .. sử dụng phẩm mầu ngoài danh mục cho phép của Bộ Y tế. Bên cạnh đó, còn rất nhiều mẫu thực phẩm ở các khu vực \
    khác như: đồ khô, mứt, dưa muối, bánh bao, sữa tiệt trùng, tương bột, mì ăn liền... sử dụng chất phụ gia ngoài \
    danh mục, hoặc nhiều chất phụ gia cùng lúc với mức sử dụng quá giới hạn cho phép.  Bằng mắt thường, người tiêu\
    dùng, kể cả người có chuyên môn cũng khó phát hiện được các loại phụ gia độc hại có trong thực phẩm. Do đó, nếu\
    không kiểm soát tốt việc kinh doanh và sử dụng loại phụ gia này thì nguy cơ ngộ độc cấp tính cũng như bị các \
    bệnh mãn tính khó tránh khỏi. Ảnh hưởng của chất phụ gia không được phép sử dụng là rất lớn, nhưng hiện nay \
    việc quản lý chưa được chặt chẽ. Các loại phụ gia dùng trong công nghiệp lẫn thực phẩm với đủ loại, từ tạo hương \
    vị, tạo mầu, tạo vị ngon đến các chất làm cho thực phẩm dẻo hơn, dai hơn... vẫn được bày bán khá công khai \
    và phần lớn đều không thực hiện đúng quy định. Nhiều loại phụ gia thực phẩm không có nhãn hướng dẫn sử dụng, \
    cách bảo quản, thời hạn sử dụng... Phần lớn những người tham gia kinh doanh mặt hàng này cũng chưa có kiến\
    thức nhất định về mặt hàng mình đang kinh doanh.  Vì vậy, để bảo đảm vệ sinh an toàn thực phẩm, cần kiểm soát \
    được việc kinh doanh và sử dụng các loại phụ gia ngoài danh mục. Theo quy định, ngành y tế được giao chức năng\
    quản lý chất phụ gia cho vào thực phẩm, nhưng muốn quản lý được chặt chẽ chất này từ đầu vào (trồng trọt, chăn\
    nuôi) đến đầu ra (chế biến thành thực phẩm) thì cần có sự phối hợp liên ngành: y tế, nông nghiệp, công \
    thương, công an. Cần có những chế tài quy định chặt chẽ việc kinh doanh, mua bán chất phụ gia thực phẩm\
    . Tổ chức giám sát chặt chẽ, có quy định nghiêm ngặt, tránh tình trạng lạm dụng các chất phụ gia trong \
    chế biến thực phẩm.  Bên cạnh việc thường xuyên bổ sung thêm danh mục các chất phụ gia được sử dụng trong \
    thực phẩm, cần tăng cường hoạt động thanh tra, kiểm tra để phát hiện các cơ sở kinh doanh chất phụ gia\
    trái quy định cũng như việc phát hiện sớm các cơ sở sản xuất thực phẩm sử dụng phụ gia ngoài danh mục.\
    Trên cơ sở đó, xử lý nghiêm các cơ sở vi phạm.  Quản lý tốt từ kinh doanh đến sử dụng phụ gia thực phẩm \
    là việc làm hết sức cần thiết, nhất là khi Tết Nguyên đán đang đến, nhu cầu các loại thực phẩm của \
    người dân đang tăng cao. Có vậy mới góp phần hạn chế tình trạng ngộ độc thực phẩm cũng như phòng ngừa\
    được các bệnh mãn tính.', {
        maxTokensToMerge: 3,
        keepMergedOnly: true,
        tryToBeSmart: 1
    });

    assert.includes(tokens, 'chất phụ gia');
    assert.includes(tokens, 'bộ y tế');
    assert.includes(tokens, '15,6%');
    assert.includes(tokens, 'thực phẩm');
    assert.includes(tokens, 'rhodamine b');
    assert.includes(tokens, 'tết nguyên đán');
    
    tokens = documentModel.parseText('So với cuối tuần trước, giá vàng SJC giảm khoảng 300 nghìn đồng/lượng.\
    Giá vàng Rồng Thăng Long của Bảo Tín Minh Châu giao dịch ở 40,55- 40,85 triệu đồng/lượng (mua vào - bán\
    ra), thấp hơn giá vàng SJC khoảng 1 triệu đồng/lượng. Sacombank SBJ vẫn báo giá vàng SJC bán ra với giá\
    tròn 42 triệu đồng/lượng và giá mua vào là 41,6 triệu đồng/lượng.\
    Tính chung, các tổ chức kinh doanh kim hoàn sáng nay kéo giá vàng miếng giảm từ 500.000 - 760.000 đồng\
    mỗi lượng so với giá mua bán sáng qua, mức giảm cũng gần tương đương với đà giảm của vàng thế giới.\
    Vàng thế giới giao ngay theo Kitco hiện ở 1.567,40 USD/oz, thấp hơn giá vàng quy đổi trong nước khoảng\
    2,1 triệu đồng/lượng.\
    Đầu giờ sáng nay (8/6), nhiều ngân hàng giảm giá bán USD 11 đồng so với chốt ngày hôm qua, đã dưới trần.\
    Giá bán USD ở mức 21.025 - 21.036 đồng/USD. Giá mua USD ở mức 20.935 - 20.950 đồng/USD.\
    Giá ở VCB là 20.950 – 21.036 đồng/USD; giá Eximbank là 20.945 – 21.025 đồng/USD.\
    Theo Ngân hàng Nhà nước, tỷ giá bình quân liên ngân hàng ngày hôm nay (8/6) vẫn ở mức 20.828 đồng/USD.\
    Tỷ giá trần của các ngân hàng thương mại là 21.036 đồng/USD.\
    Phước Hà', {
        maxTokensToMerge: 3,
        keepMergedOnly: true,
        tryToBeSmart: 1
    });
    
    assert.includes(tokens, 'giá vàng');
    assert.includes(tokens, 'sjc');
    assert.includes(tokens, 'bảo tín minh châu');
    assert.includes(tokens, 'sacombank sbj');
    assert.includes(tokens, 'eximbank');
    assert.includes(tokens, 'vcb');
    assert.includes(tokens, 'ngân hàng');
    assert.includes(tokens, '300 nghìn đồng/lượng');
    assert.includes(tokens, '40,85 triệu đồng/lượng');
    assert.includes(tokens, '42 triệu đồng/lượng');
    assert.includes(tokens, '41,6 triệu đồng/lượng');
    assert.includes(tokens, '1.567,40 usd/oz');
    assert.includes(tokens, '2,1 triệu đồng/lượng');
    assert.includes(tokens, '8/6');
    assert.includes(tokens, '21.036 đồng/usd');
    assert.includes(tokens, '20.950 đồng/usd');
    assert.includes(tokens, '21.036 đồng/usd');
    assert.includes(tokens, '21.025 đồng/usd');
    assert.includes(tokens, '20.828 đồng/usd');
    assert.includes(tokens, '21.036 đồng/usd');
}

exports['test DocumentModel#parseText/names'] = function(beforeEnd, assert) {
    var tokens = documentModel.parseText('hello Jacky Chan', { ignoredList:[] });
    assert.equal(2, tokens.length);
    
    tokens = documentModel.parseText('Hello Jacky Chan', { ignoredList:[] });
    assert.equal(2, tokens.length);
    
    tokens = documentModel.parseText('Jacky Chan is the best!', { ignoredList:[] });
    assert.equal(5, tokens.length);
}

exports['test DocumentModel#parseText/numbers'] = function(beforeEnd, assert) {
    var tokens = documentModel.parseText('12 is twelve', { ignoredList:[] });
    assert.equal(2, tokens.length);
    
    tokens = documentModel.parseText('one-hundred-and-one equals 101', { ignoredList:[] });
    assert.equal(3, tokens.length);
    
    tokens = documentModel.parseText('120,000 is pretty big', { ignoredList:[] });
    assert.equal(4, tokens.length);
    assert.equal('120,000', tokens[0]);
    
    tokens = documentModel.parseText('120 tỉ đồng is a LOT of money!', { ignoredList:[] });
    assert.equal(6, tokens.length);
    
    tokens = documentModel.parseText('12    nghìn    tỉ    đồng', { ignoredList:[] });
    assert.equal(1, tokens.length);
    assert.equal('12 nghìn tỉ đồng', tokens[0]);
    
    tokens = documentModel.parseText('12 vạn hécta', { ignoredList:[] });
    assert.equal(2, tokens.length);

    tokens = documentModel.parseText('9 tháng 10 ngày', { ignoredList:[] });
    assert.equal(2, tokens.length);
}