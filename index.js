const MongoStore = require('connect-mongo');

/* secret stuff */
const mongodb_host = process.env.MONGODB_HOST;
const mongodb_user = process.env.MONGODB_USER;
const mongodb_password = process.env.MONGODB_PASSWORD;
const mongodb_database = process.env.MONGODB_DATABASE;
const mongodb_session_secret = process.env.MONGODB_SESSION_SECRET;
const node_session_secret = process.env.NODE_SESSION_SECRET;
/* secret stuff */

var mongoStore = MongoStore.create({
	mongoUrl: `mongodb+srv://${mongodb_user}:${mongodb_password}@${mongodb_host}/sessions`,
	crypto: {
		secret: mongodb_session_secret
	}
});

const express = require('express');
const app = express();
const port = 8008;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
