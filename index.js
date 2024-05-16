require("./utils.js");

const express = require("express");
require("dotenv").config();
const session = require("express-session");
const MongoStore = require("connect-mongo");
const bcrypt = require("bcryptjs");
const Joi = require("joi");

const app = express();
const port = process.env.PORT;
const node_session_secret = "415e198b-ecbc-43a0-907d-6afae73c61e8";

const mongodb_host = process.env.MONGODB_HOST;
const mongodb_user = process.env.MONGODB_USER;
const mongodb_password = process.env.MONGODB_PASSWORD;
const mongodb_database = process.env.MONGODB_DATABASE;
const mongodb_session_secret = process.env.MONGODB_SESSION_SECRET;

// Create a valid MongoDB connection string
const mongoUrl = `mongodb+srv://${mongodb_user}:${mongodb_password}@${mongodb_host}/${mongodb_database}`;
//console.log(mongoUrl);

var { database } = include("databaseConnection");

const userCollection = database.db(mongodb_database).collection("users");

var mongoStore = MongoStore.create({
<<<<<<< HEAD
	mongoUrl: `mongodb+srv://${mongodb_user}:${mongodb_password}@${mongodb_host}/sessions`,
	crypto: {
		secret: mongodb_session_secret
	}
})

=======
  mongoUrl,
  crypto: {
    secret: mongodb_session_secret,
  },
});

app.use(
  session({
    secret: node_session_secret,
    store: mongoStore,
    saveUninitialized: false,
    resave: true,
  })
);

function isValidSession(req) {
  if (req.session.loggedIn) {
    return true;
  }
  return false;
}

function sessionValidation(req, res, next) {
  if (!isValidSession(req)) {
    res.redirect("/login");
  } else {
    next();
  }
}

//... rest of your code

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.set("views", "./views"); // Specify the views directory
app.set("view engine", "ejs");

// Routes
app.get("/", (req, res) => {
  res.render("home");
});

app.get("/viewposts", (req, res) => {
  res.render("viewposts");
});

app.get("/journal", (req, res) => {
  res.render("journal");
});

app.get("/userpage", (req, res) => {
  res.render("userpage");
});



app.get("/login", (req, res) => {
  res.render("login");
});

app.post("/loggingIn", async (req, res) => {
  var username = req.body.username;
  var password = req.body.password;

  const schema = Joi.object({
    username: Joi.string().regex(/^[a-zA-Z0-9-_@.]+$/).required(),
    password: Joi.string().required()
  });

  const validationResult = schema.validate({ username, password });

  if (validationResult.error != null) {
    console.log(validationResult.error);
    res.render("invalidLogin", { loggedIn: false, isLoginPage: false });
    return;
  }

  const result = await userCollection
    .find({ username: username })
    .project({ username: 1, password: 1, savedDraft: 1, savedPosts: 1, userPosts: 1 })
    .toArray();

  if (result.length === 0) {
    // Handle case when no user is found with the provided email
    res.status(400);
    res.render("invalidLogin", { loggedIn: false, isLoginPage: false });
    return;
  }

  console.log(result);
  if (result.length != 1) {
    res.status(400);
    res.render("invalidLogin", { loggedIn: false, isLoginPage: false });
  }
  if (await bcrypt.compare(password, result[0].password)) {
    console.log("correct password");
    req.session.loggedIn = true;
    req.session.name = result[0].name;
    req.session.user_type = result[0].user_type;
    req.session.cookie.maxAge = expireTime;

    res.redirect("/profile");
    return;
  } else {
    res.status(400);
    res.render("invalidLogin", { loggedIn: false, isLoginPage: false });
  }
});

app.get("/profile", sessionValidation, async (req, res) => {

  const username = req.session.username;

  const result = await userCollection.findOne({ username });

  if (!result) {
    res.status(404);
    res.render("error", { message: "User not found" });
    return;
  }

  const { savedDraft, savedPosts, userPosts } = result;

  res.render("admin", { savedDraft, savedPosts, userPosts, loggedIn: false, isloggedIn: false });
});

app.listen(port, () => {
  console.log(`Server is running on port: ${port}`);
});
>>>>>>> d53eab8c7bf508f637f9270d1e36a6126f748399
