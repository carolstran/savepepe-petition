const express = require('express');
const app = express();
const hb = require('express-handlebars');

const router = require('./routes/routes');

// HANDLEBARS
app.engine('handlebars', hb());
app.set('view engine', 'handlebars');

// RETRIEVE STATIC FILES
app.use(express.static(__dirname + '/public'));

// ROUTER
app.use('/', router);

// LISTENING
app.listen(process.env.PORT || 8080, function() {
    console.log('LISTENING');
});
