(function() {
    var canvas = $('#canvas');
    const context = canvas[0].getContext('2d');

    var startX;
    var startY;
    var hasSigned;

    canvas.on('mousedown', function(e) {
        startX = e.offsetX;
        startY = e.offsetY;

        canvas.on('mousemove', function(e) {
            drawLine(e.offsetX, e.offsetY);
        });
    }).on('mouseup', function() {
        canvas.off('mousemove');
    });

    function drawLine(x, y) {
        context.strokeStyle = '#FFF';
        context.beginPath();
        context.moveTo(startX, startY);
        context.stroke();
        context.lineTo(x, y);
        context.stroke();

        startX = x;
        startY = y;

        hasSigned = true;
    }

    $('#petition-form').on('submit', function(e) {
        let dataUrl;
        dataUrl = canvas.get(0).toDataURL();
        if (hasSigned) {
            $('#signature').val(dataUrl);
        }
    });

    function clearSignature() {
        $('#clear-signature').on('click', function(e) {
            $('#signature').val('');
            context.clearRect(0, 0, canvas.width, canvas.height);
            context.closePath();
            context.beginPath();
        });
    }

    if ($('#clear-signature').length) {
        clearSignature();
    }

}) ();

$('#logout').on('click', function(e) {
    $.ajax({
        method: 'POST',
        url: '/logout',
        success: function(route) {
            window.location = route;
        }
    });
});
