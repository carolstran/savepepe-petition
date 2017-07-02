const spicedPg = require('spiced-pg');

var dbUrl = process.env.DATABASE_URL || require('./passwords.json').dbUrl;
const db = spicedPg(dbUrl);

const auth = require('./auth');

function registerUser(first, last, email, hash) {
    let q = `INSERT INTO users (first_name, last_name, email, password_hash)
             VALUES ($1, $2, $3, $4) RETURNING id;`;

    let params = [
        first,
        last,
        email,
        hash
    ];

    return db.query(q, params).then(function(results) {
        return results.rows[0];
    }).catch(function(err) {
        console.log('Error registerUser in DB', err);
        throw err;
    });
}

function insertProfile(age, city, homepage, user_id) {
    console.log('Insert profile function running');
    let q = `INSERT INTO user_profiles (age, city, homepage, user_id)
             VALUES ($1, $2, $3, $4)`;

    let params = [
        age,
        city,
        homepage,
        user_id
    ];

    return db.query(q, params).then(function() {
        console.log('Profile inserted');
    }).catch(function(err) {
        console.log('Error insertProfile in DB', err);
    });
}


function checkAccount(email, password) {
    let q = `SELECT * FROM users WHERE email = $1;`;
    let params = [
        email
    ];

    return db.query(q, params)
    .then(function(result) {
        if (result.rows) {
            var hashedPassword = result.rows[0].password_hash;
            return auth.checkPassword(password, hashedPassword)
            .then(function(passwordMatch) {

                let newObj = {
                    passwordMatch: passwordMatch,
                    user_email: result.rows[0].email,
                    user_first: result.rows[0].first_name,
                    user_last: result.rows[0].last_name,
                    user_hash: result.rows[0].password_hash,
                    user_id: result.rows[0].id
                };
                return newObj;
            }).catch(function(err) {
                console.log('Error auth.checkPassword in DB', err);
                throw err;
            });
        } else {
            throw new Error('Account not found');
        }
    }).catch(function(err) {
        console.log('Error checkAccount in DB', err);
        throw err;
    });
}

function signPetition(user_id, signature) {
    let q = `INSERT INTO signatures (user_id, signature)
             VALUES ($1, $2) RETURNING id;`;
    let params = [
        user_id,
        signature
    ];

    return db.query(q, params).then(function(result) {
        return result.rows[0].id;
    }).catch(function(err) {
        console.log('Error signPetition in DB', err);
        throw err;
    });
}

function checkForSignature(session) {
    let q = `SELECT * FROM users INNER JOIN signatures
             ON users.id = signatures.user_id WHERE users.id = $1;`;

    let params = [
        session.user.id
    ];

    return db.query(q, params).then(function(result) {
        var signature = result.rows[0];
        var hasSigned;

        if (signature) {
            hasSigned = true;
        } else {
            hasSigned = false;
        }
        return hasSigned;
    }).catch(function(err) {
        console.log('Error checkForSignature in DB', err);
        throw err;
    });
}


function showSignature(user_id) {
    let q = `SELECT signature FROM signatures WHERE user_id = $1;`;

    let params = [
        user_id
    ];

    return db.query(q, params).then(function(result) {
        return result.rows[0].signature;
    }).catch(function(err) {
        console.log('Error showSignature in DB', err);
        throw err;
    });
}

function deleteSignature(user_id) {
    let q = `DELETE from signatures WHERE user_id = $1;`;
    let params = [
        user_id
    ];

    return db.query(q, params).then(function() {
        console.log('Signature was deleted');
    }).catch(function(err) {
        console.log('Error deleteSignature in DB', err);
    });
}

function getSigners() {
    let q = `SELECT first_name, last_name, homepage, age, city FROM signatures
             LEFT OUTER JOIN users ON signatures.user_id = users.id
             LEFT OUTER JOIN user_profiles
             ON signatures.user_id = user_profiles.user_id;`;

    return db.query(q, []).then(function(results) {
        return results.rows;
    }).catch(function(err) {
        console.log('Error getSigners in DB', err);
        throw err;
    });
}

function getSignersByCity(city) {
    let q = `SELECT first_name, last_name, homepage, age FROM signatures
             LEFT OUTER JOIN users ON signatures.user_id = users.id
             LEFT OUTER JOIN user_profiles
             ON signatures.user_id = user_profiles.user_id
             WHERE city = $1;`;
    let params = [
        city
    ];

    return db.query(q, params).then(function(results) {
        return results;
    }).catch(function(err) {
        console.log('Error getSignersByCity in DB', err);
        throw err;
    });
}

function countSigners() {
    let q = `SELECT COUNT(id) FROM signatures;`;

    return db.query(q).then(function(result) {
        return result.rows[0].count;
    }).catch(function(err) {
        console.log('Error countSigners in DB', err);
        throw err;
    });
}

function getProfile(id) {
    let q = `SELECT * FROM users JOIN user_profiles
             ON users.id = user_profiles.user_id
             WHERE users.id = $1;`;
    let params = [
        id
    ];

    return db.query(q, params).then(function(result) {
        return result.rows[0];
    }).catch(function(err) {
        console.log('Error getProfile in DB', err);
        throw err;
    });
}

function updateUser(result, first, last, email, password, user_id) {
    var q = '';
    var params;

    if (password != '') {
        auth.hashPassword(password).then(function(hash) {
            q = `UPDATE users SET first_name = $1, last_name = $2, email = $3, password_hash = $4 WHERE user_id = $5;`;
            params = [
                first,
                last,
                email,
                hash,
                user_id
            ];

            return db.query(q, params).then(function(result) {
                return result;
            }).catch(function(err) {
                console.log('Error updateUser with password in DB', err);
                throw err;
            });
        });
    } else {
        q = `UPDATE users SET first_name = $1, last_name = $2, email = $3 WHERE user_id = $4;`;
        params = [
            first,
            last,
            email,
            user_id
        ];

        return db.query(q, params).then(function(result) {
            return result;
        }).catch(function(err) {
            console.log('Error updateUser in DB', err);
            throw err;
        });
    }
}

function updateProfile(age, city, homepage, user_id) {
    let q = `UPDATE user_profiles SET age = $1, city = $2, homepage = $3 WHERE users.id = $4;`;
    let params = [
        age,
        city,
        homepage,
        user_id
    ];

    return db.query(q, params).then(function(result) {
        return result;
    }).catch(function(err) {
        console.log('Error updateProfile in DB', err);
        throw err;
    });
}

module.exports.registerUser = registerUser;
module.exports.insertProfile = insertProfile;
module.exports.checkAccount = checkAccount;
module.exports.signPetition = signPetition;
module.exports.checkForSignature = checkForSignature;
module.exports.showSignature = showSignature;
module.exports.deleteSignature = deleteSignature;
module.exports.getSigners = getSigners;
module.exports.getSignersByCity = getSignersByCity;
module.exports.countSigners = countSigners;
module.exports.getProfile = getProfile;
module.exports.updateUser = updateUser;
module.exports.updateProfile = updateProfile;
