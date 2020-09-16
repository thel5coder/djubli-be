/* eslint-disable linebreak-style */
/* eslint-disable import/no-dynamic-require */
/* eslint-disable global-require */
const express = require('express');
const logger = require('morgan');
const bodyParser = require('body-parser');
const path = require('path');
const multer = require('multer');
const passport = require('passport');
const cors = require('cors');
const redis = require('redis');

// require('./helpers/cron/bargainsCron');
require('pg').defaults.parseInt8 = true;

const acceptedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'svg'];
const upload = multer({
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB upload limit
    files: 1 // 1 file
  },
  // eslint-disable next-line
  fileFilter: (req, file, cb) => {
    // if the file extension is in our accepted list
    if (acceptedExtensions.some(ext => file.originalname.endsWith(`.${ext}`))) {
      return cb(null, true);
    }

    // otherwise, return error
    return cb(new Error(`Only ${acceptedExtensions.join(', ')} files are allowed!`));
  }
});

const port = process.env.PORT || 5000;
const app = express();
const http = require('http').Server(app);
// const io = require('socket.io')(http);
const io = require('socket.io')(http, {
  // path: '/socket',
  serveClient: false,
  // below are engine.IO options
  pingInterval: 10000,
  pingTimeout: 5000,
  cookie: false,
  handlePreflightRequest: (req, res) => {
    const allowedOrigins = [
      'https://apidev-djublee.twisdev.com',
      'https://apistage-djublee.twiscoder.com',
      'http://localhost:5000'
    ];

    let origin = 'https://apidev-djublee.twisdev.com';
    if (allowedOrigins.includes(req.headers.origin)) {
      origin = req.headers.origin;
    }

    const headers = {
      // 'Access-Control-Allow-Origin': req.headers.origin, // or the specific origin you want to give access to,
      // 'Access-Control-Allow-Origin': req.header('host'),
      // 'Access-Control-Allow-Origin': `https://apidev-djublee.twisdev.com`,
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Credentials': true
    };
    res.writeHead(200, headers);
    res.end();
  }
});

// for dynamic route
const routes = require('./lib/readfile').walkSync('./routes');

/* Read .env */
require('dotenv').config();

app.use(logger('dev'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(upload.fields([{ name: 'images', maxCount: 8 }]));

app.use(cors());

// Initializing passport
app.use(passport.initialize());
require('./config/passport')(passport);

const client = redis.createClient(process.env.REDIS_HOST);
// const client = redis.createClient(6379, 'localhost');
client.on('error', err => {
  console.log(`Error ${err}`);
});

// app.get('/socket-message', (req, res) => {
//   res.sendFile(`${__dirname}/socket-message.html`);
// });

// io.on('connection', socket => {
//   console.log('client connected');

//   socket.on('negotiation-car', msg => {
//     console.log(`Message: ${msg}`);
//   });
// });

// enable socket io to routes
app.use((req, res, next) => {
  req.io = io;
  req.redis = client;
  next();
});

let count = 0;
const array = [];
routes.forEach(file => {
  let routePath = file
    .split(path.sep)
    .slice(1, -1)
    .join(path.sep);
  routePath = `/${routePath}/${path.parse(file).name}`;
  const routeFile = require(`./${file}`);
  app.use(routePath, routeFile);
  count += 1;
  array.push(routePath);
});

http.listen(port, () => {
  array.map(route => console.log(route));
  console.log(`Running ${count} url(s) and listening on PORT:${port}`);
});
