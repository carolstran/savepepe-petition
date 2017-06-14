const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
// const cookieSession = require('cookie-session');

const express = require('express');
const router = express.Router();

const db = require('../config/db');
const auth = require('../config/auth');

const csrf = require('csurf');
const csrfProtection = csrf({ cookie: true });

const session = require('express-session');
const Store = require('connect-redis')(session);
const redis = require('redis');

router.use(session({
    store: new Store({
        url: 'redis://h:pb92b6a1a7b66b80e1c7d894c82fb5e84abc2b485074a22d17c034f130322d670@ec2-34-250-146-11.eu-west-1.compute.amazonaws.com:21749',
        port: 6379
    }),
    resave: false,
    saveUninitialized: true,
    secret: 'qZGpmj5rD13ocrP'
}));

const client = redis.createClient({
    host: 'localhost',
    port: 6379
});

client.on('error', function(err) {
    console.log(err);
});

router.use(bodyParser.urlencoded({
    extended: false
}));

router.use(cookieParser());

// PUBLIC ROUTES
router.route('/')

    .get(function(req, res) {
        if (req.session.user) {
            res.redirect('/petition');
        } else {
            res.redirect('/welcome');
        }
    });

router.route('/welcome')

    .get(function(req, res) {
        res.render('welcome', {
            layout: 'public',
        });
    });

router.route('/register')

    .get(csrfProtection, function(req, res) {
        if (req.session.user) {
            res.redirect('/petition');
        } else {
            res.render('register', {
                layout: 'public',
                csrfToken: req.csrfToken()
            });
        }
    })

    .post(csrfProtection, function(req, res) {
        if (!req.body.first || !req.body.last || !req.body.email || !req.body.password) {
            res.render('register', {
                layout: 'public',
                csrfToken: req.csrfToken(),
                error: 'Looks like you didn\'t fill out all of the required fields. Try again!'
            });
        }

        let first = (req.body.first).toUpperCase();
        let last = (req.body.last).toUpperCase();

        auth.hashPassword(req.body.password).then(function(hash) {
            db.registerUser(first, last, req.body.email, hash).then(function(result) {
                req.session.user = {
                    id: result.id,
                    first_name: first,
                    last_name: last,
                    email: req.body.email
                };
                return req.session.user;
            }).then(function() {
                res.redirect('/register/setup');
            });
        }).catch(function(err) {
            console.log('Error hashing password', err);
            res.render('register', {
                layout: 'public',
                csrfToken: req.csrfToken(),
                error: 'Something went wrong! Please try again.'
            });
        });
    });

router.route('/register/setup')

    .get(csrfProtection, function(req, res) {
        if (!req.session.user) {
            res.redirect('/welcome');
        } else {
            res.render('setup', {
                layout: 'public',
                csrfToken: req.csrfToken(),
            });
        }
    })

    .post(csrfProtection, function(req, res) {
        let city = (req.body.city).toUpperCase();
        let age = req.session.user.age;
        let homepage = req.session.user.homepage;

        if (req.body.age == '') {
            age = null;
        } else {
            age = req.body.age;
        }

        req.session.user.city = city;
        homepage = req.body.homepage;

        db.insertProfile(age, city, homepage, req.session.user.id)
        .then(function() {
            client.del('rows');
            res.redirect('/petition');
        }).catch(function(err) {
            console.log('Error inserting profile', err);
            res.render('setup', {
                layout: 'public',
                csrfToken: req.csrfToken(),
                error: 'Something went wrong! Please try again.'
            });
        });
    });

router.route('/login')

    .get(csrfProtection, function(req, res) {
        if (req.session.user) {
            res.redirect('/petition');
        } else {
            res.render('login', {
                layout: 'public',
                csrfToken: req.csrfToken()
            });
        }
    })

    .post(csrfProtection, function(req, res) {
        if (!req.body.email || !req.body.password) {
            res.render('login', {
                layout: 'public',
                csrfToken: req.csrfToken(),
                error: 'So close! Please enter your email <em>and</em> password. '
            });
        }

        db.checkAccount(req.body.email, req.body.password).then(function(userObj) {
            if (userObj.passwordMatch == true) {
                req.session.user = {
                    id: userObj.user_id,
                    first_name: userObj.user_first,
                    last_name: userObj.user_last,
                    email: userObj.user_email
                };
                req.session.user;
                res.redirect('/petition');
            } else if (userObj.passwordMatch == false) {
                res.render('login', {
                    layout: 'public',
                    csrfToken: req.csrfToken(),
                    error: 'Looks like that account doesn\'t exist. Do you want to <a href="/register">sign up</a>?'
                });
            }
        }).catch(function(err) {
            console.log('Error checking account', err);
            res.render('login', {
                layout: 'public',
                csrfToken: req.csrfToken(),
                error: 'Something went wrong! Please try again.'
            });
        });
    });

// PETITION ROUTES
router.route('/petition')

    .get(csrfProtection, function(req, res) {
        if (!req.session.user) {
            res.redirect('/welcome');
        } else {
            db.checkForSignature(req.session).then(function(hasSigned) {
                if (hasSigned == true) {
                    res.redirect('/petition/thanks');
                } else {
                    res.render('petition', {
                        layout: 'main',
                        csrfToken: req.csrfToken(),
                        name: req.session.user.first_name
                    });
                }
            });
        }
    })

    .post(csrfProtection, function(req, res) {
        if (!req.body.signature) {
            res.render('petition', {
                layout: 'main',
                csrfToken: req.csrfToken(),
                name: req.session.user.first_name,
                error: 'You need to actually sign below! Just click and drag your cursor.'
            });
        }

        db.signPetition(req.session.user.id, req.body.signature).then(function() {
            res.cookie('signed', 'true');
            res.redirect('/petition/thanks');
        }).catch(function(err) {
            console.log('Error signing petition', err);
            res.render('petition', {
                layout: 'main',
                csrfToken: req.csrfToken(),
                error: 'Something went wrong! Please try again.'
            });
        });
    });

router.route('/petition/thanks')

    .get(csrfProtection, function(req, res) {
        if (!req.session.user) {
            res.redirect('/welcome');
        } else {
            db.checkForSignature(req.session).then(function(hasSigned) {
                if (hasSigned == true) {
                    db.showSignature(req.session.user.id).then(function(signature) {
                        db.countSigners().then(function(count) {
                            res.render('thanks', {
                                layout: 'main',
                                csrfToken: req.csrfToken(),
                                name: req.session.user.first_name,
                                signatureUrl: signature,
                                count: count
                            });
                        });
                    }).catch(function(err) {
                        console.log('Error showing signature', err);
                    });
                } else {
                    res.redirect('/petition');
                }
            }).catch(function(err) {
                console.log('Error checking for signature', err);
            });
        }
    });

router.route('/petition/delete')

    .post(csrfProtection, function(req, res) {
        db.deleteSignature(req.session.user.id).then(function() {
            client.del('rows');
            res.redirect('/petition');
        }).catch(function(err) {
            console.log('Error deleting signature', err);
        });
    });


// SIGNERS ROUTES
router.route('/signers')

    .get(csrfProtection, function(req, res) {
        if (!req.session.user) {
            res.redirect('/welcome');
        } else {
            db.checkForSignature(req.session).then(function(hasSigned) {
                if (hasSigned == true) {
                    client.get('rows', function(err, signerRows) {
                        if (err) {
                            console.log(err);
                            return;
                        } else if (signerRows != null) {
                            let signers = JSON.parse(signerRows);
                            db.countSigners().then(function(count) {
                                res.render('signers', {
                                    layout: 'main',
                                    csrfToken: req.csrfToken(),
                                    signers: signers,
                                    count: count
                                });
                            });
                        } else {
                            db.getSigners().then(function(results) {
                                let signers = JSON.stringify(results.rows);
                                client.set('rows', `${signers}`, function(err, data) {
                                    if (err) {
                                        res.render('signers', {
                                            layout: 'main',
                                            csrfToken: req.csrfToken(),
                                            error: 'Something went wrong! Please try again.'
                                        });
                                    }
                                });
                                db.countSigners().then(function(count) {
                                    res.render('signers', {
                                        layout: 'main',
                                        csrfToken: req.csrfToken(),
                                        signers: results.rows,
                                        count: count
                                    });
                                });
                            }).catch(function(err) {
                                console.log('Error getting signers', err);
                            });
                        }
                    });
                } else {
                    res.redirect('/petition');
                }
            });
        }
    });

router.route('/signers/:city')

    .get(csrfProtection, function(req, res) {
        let city = req.params.city;

        db.getSignersByCity(city).then(function(results) {
            db.countSigners().then(function(count) {
                res.render('bycity', {
                    layout: 'main',
                    csrfToken: req.csrfToken(),
                    city: city,
                    signers: results.rows,
                    count: count
                });
            });
        });
    });

// SHARE ROUTES
router.route('/share')

    .get(csrfProtection, function(req, res) {
        if (!req.session.user) {
            res.redirect('/welcome');
        } else {
            res.render('share', {
                layout: 'main',
                csrfToken: req.csrfToken()
            });
        }
    });

// PROFILE ROUTES
router.route('/profile')

    .get(csrfProtection, function(req, res) {
        if (!req.session.user) {
            res.redirect('/welcome');
        } else {
            db.getProfile(req.session.user.id).then(function(result) {
                res.render('profile', {
                    layout: 'main',
                    user: result,
                    csrfToken: req.csrfToken()
                });
            });
        }
    });

router.route('/profile/edit')

    .get(csrfProtection, function(req, res) {
        if (!req.session.user) {
            res.redirect('/welcome');
        } else {
            db.getProfile(req.session.user.id).then(function(result) {
                res.render('edit', {
                    layout: 'main',
                    user: result,
                    csrfToken: req.csrfToken()
                });
            });
        }
    })

    .post(csrfProtection, function(req, res) {
        var first = (req.body.first).toUpperCase();
        var last = (req.body.last).toUpperCase();
        var email = req.body.email;
        var city = (req.body.city).toUpperCase();

        if (!first || !last || !email) {
            res.render('edit', {
                layout: 'main',
                error: 'You must include your name and email to proceed.',
                csrfToken: req.csrfToken()
            });
        }

        db.getProfile(req.session.user.id).then(function(result) {
            return db.updateUser(result, first, last, email, req.body.password, req.session.user.id).then(function() {
                return db.updateProfile(req.body.age, city, req.body.homepage, req.session.user.id).then(function() {
                });
            }).then(function() {
                client.del('rows');
                res.redirect('/profile');
            }).catch(function(err) {
                console.log('Error getting profile', err);
                res.render('edit', {
                    layout: 'main',
                    error: 'Something went wrong! Please try again.',
                    csrfToken: req.csrfToken()
                });
            });
        });
    });

// NAV ROUTES
router.route('/logout')

    .post(function(req, res, next) {
        req.session.destroy();
        res.end('/welcome');
        next();
    });

// EXPORTS
module.exports = router;
