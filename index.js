require("./utils.js");

const express = require('express');
require('dotenv').config();
const session = require('express-session');
const MongoStore = require('connect-mongo');
const bcrypt = require('bcrypt');

const app = express();
const port = process.env.PORT;
const node_session_secret = '415e198b-ecbc-43a0-907d-6afae73c61e8';

const mongodb_host = process.env.MONGODB_HOST;
const mongodb_user = process.env.MONGODB_USER;
const mongodb_password = process.env.MONGODB_PASSWORD;
const mongodb_database = process.env.MONGODB_DATABASE;
const mongodb_session_secret = process.env.MONGODB_SESSION_SECRET;

// Create a valid MongoDB connection string
const mongoUrl = `mongodb+srv://${mongodb_user}:${mongodb_password}@${mongodb_host}/${mongodb_database}`;
//console.log(mongoUrl);

var {database} = include('databaseConnection');

const userCollection = database.db(mongodb_database).collection('users');

var mongoStore = MongoStore.create({
  mongoUrl,
  crypto: {
    secret: mongodb_session_secret
  }
});

app.use(session({
    secret: node_session_secret,
    store: mongoStore, 
    saveUninitialized: false,
    resave: true
}));

//... rest of your code


// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.set('views', './views'); // Specify the views directory
app.set('view engine', 'ejs');

// Routes
app.get('/', (req, res) => {
  res.render('home');
});

app.get('/viewposts', (req, res) => {
    res.render('viewposts');
});
  
app.get('/journal', (req, res) => {
    res.render('journal');
});
  
app.get('/userpage', (req, res) => {
    res.render('userpage');
});

app.listen(port, () => {
  console.log(`Server is running on port: ${port}`);
});
