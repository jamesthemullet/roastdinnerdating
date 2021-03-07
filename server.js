const express = require('express');
const exphbs = require('express-handlebars');
const bodyParser = require('body-parser');
const Handlebars = require('handlebars');
const { allowInsecurePrototypeAccess } = require('@handlebars/allow-prototype-access');
const mongoose = require('mongoose');
const passport = require('passport');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const flash = require('connect-flash');
const bcrypt = require('bcryptjs');

const Message = require('./models/message');
const User = require('./models/user');
const app = express();

const Keys = require('./config/keys');

const { requireLogin, ensureGuest } = require('./helpers/auth');

app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());

app.use(cookieParser());
app.use(session({
    secret: 'mysecret',
    resave: true,
    saveUninitialized: true
}));
app.use(passport.initialize());
app.use(passport.session());

app.use(flash());
app.use((req, res, next) => {
    res.locals.success_msg = req.flash('success_msg');
    res.locals.error_msg = req.flash('error_msg');
    res.locals.error = req.flash('error');
    next();
});

app.use(express.static('public'));

app.use((req, res, next) => {
    res.locals.user = req.user || null;
    next();
});

require('./passport/facebook');
require('./passport/google');
require('./passport/local');

mongoose.connect(Keys.MongoDB, { useNewUrlParser: true }).then(() => {
    console.log('server is connected to mongo db')
}).catch((err) => {
    console.log(err);
});

// environment variable for port
const port = process.env.PORT || 3000;

app.engine('handlebars', exphbs({
    defaultLayout: 'main',
    handlebars: allowInsecurePrototypeAccess(Handlebars)
}));
app.set('view engine', 'handlebars');

app.get('/', ensureGuest, (req, res) => {
    res.render('home', {
        title: 'Home'
    });
});

app.get('/about', ensureGuest, (req, res) => {
    res.render('about', {
        title: 'About'
    });
});

app.get('/contact', ensureGuest, (req, res) => {
    res.render('contact', {
        title: 'Contact'
    });
});

app.get('/auth/facebook', passport.authenticate('facebook', {
    scope: ['email']
}));

app.get('/auth/facebook/callback', passport.authenticate('facebook', {
    successRedirect: '/profile',
    failureRedirect: '/'
}));

app.get('/auth/google', passport.authenticate('google', {
    scope: ['profile']
}));

app.get('/auth/google/callback', passport.authenticate('google', {
    successRedirect: '/profile',
    failureRedirect: '/'
}))

app.get('/profile', requireLogin, (req, res) => {
    console.log(9, req.user)
    User.findById({_id: req.user._id}).then((user) => {
        if (user) {
            user.online = true;
            user.save((err, user) => {
                if (err) {
                    throw err
                } else {
                    res.render('profile', {
                        title: 'Profile',
                        user: user
                    });
                }
            });
        }
    })
});

app.get('/newAccount', (req, res) => {
    res.render('newAccount', {
        title: 'Sign up'
    })
});
app.post('/signup', (req, res) => {
    let errors = [];
    if (req.body.password !== req.body.password2) {
        errors.push({text: 'Password does not match'});
    }
    if (req.body.password.length < 8) {
        errors.push({text: 'Password must be a minimum of 8 characters'});
    }
    if (errors.length) {
        res.render('newAccount', {
            errors: errors,
            title: 'Error',
            fullname: req.body.username,
            email: req.body.email,
            password: req.body.password
        });
    } else {
        User.findOne({email: req.body.email}).then((user) => {
            if (user) {
                let errors = [];
                errors.push({text: 'Email already exists'});
                res.render('newAccount', {
                    title: 'Signup',
                    errors: errors
                });
            } else {
                const salt = bcrypt.genSaltSync(10);
                const hash = bcrypt.hashSync(req.body.password, salt);
                const newUser = {
                    fullname: req.body.username,
                    email: req.body.email,
                    password: hash 
                }
                new User(newUser).save((err, user) => {
                    if (err) {
                        throw err;
                    }
                    if (user) {
                        let success = [];
                        success.push({
                            text: 'You have created a new account.  Bring on the gravy dating.  Please log in.'
                        });
                        res.render('home', {
                            success: success
                        });
                    }
                });
            }
        });
    }
});

app.post('/login', passport.authenticate('local', {
    successRedirect: '/profile',
    failureRedirect: '/loginErrors'
}));

app.get('/loginErrors', (req, res) => {
    let errors = [];
    errors.push({ text: 'User not found or password incorrect'});
    res.render('home', {
        errors: errors
    });
});

app.get('/logout', (req, res) => {
    console.log(19, req.user)
    User.findById({_id: req.user._id}).then((user) => {
        user.online = false;
        user.save((err, user) => {
            if (err) {
                throw err;
            }
            if (user) {
                req.logout();
                res.redirect('/');
            }
        });
    });
});

app.post('/contactUs', (req, res) => {
    const newMessage = {
        fullname: req.body.fullname,
        email: req.body.email,
        message: req.body.message,
        date: new Date()
    }

    new Message(newMessage).save((err, message) => {
        console.log(1, newMessage)
        if (err) {
            throw err
        } else {
            Message.find({}).then((messages) => {
                if (messages) {
                    console.log(2, messages)
                    res.render('newMessage', {
                        title: 'Sent',
                        messages: messages
                    });
                } else {
                    res.render('noMessage', {
                        title: 'Not found'
                    })
                }
            })
        }
    })
});

app.listen(port, () => {
    console.log(`Gravy is running on port ${port}`)
});