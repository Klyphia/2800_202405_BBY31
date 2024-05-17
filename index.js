require("./utils.js");

const express = require("express");
require("dotenv").config();
const session = require("express-session");
const MongoStore = require("connect-mongo");
const bcrypt = require("bcryptjs");
const Joi = require("joi");
const saltRounds = 12;
const expireTime = 24 * 60 * 60 * 1000; // session expires after a day

const app = new express();
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

app.use(express.static(__dirname+'/public'));

function isValidSession(req) {
  if (req.session.loggedIn) {
    return true;
  }
  return false;
}

function sessionValidation(req, res, next) {
  if (!isValidSession(req)) {
    console.log('Going to landing page.')
    res.render('landingPage');
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
app.get("/", sessionValidation, async (req, res) => {
  res.render("home");
});
app.get("/passwordReset", (req, res) => {
  res.render("passwordReset");
});

// Route for creating user post
app.get("/createPost", sessionValidation, async (req, res) => {
  res.render("createPost");
});

app.post("/submitPost", sessionValidation, async (req, res) => {
  try {
    // Get form data from request body
    const { postTitle, postTag, postUploadImage, postContent } = req.body;
    const username = req.session.username;

    // Create a post object
    const post = {
      postId: new ObjectId(), // Generate a unique postId (assuming you're using MongoDB ObjectId)
      postTitle: postTitle,
      postTag: postTag,
      postUploadImage: postUploadImage,
      postContent: postContent,
      comments: [] // Initialize an empty comments array for the post
    };

    // Update user document in the database to add the new post to userPosts array
    await userCollection.updateOne(
      { username: username },
      { $push: { userPosts: post } }
    );

    res.redirect("/postConfirmation"); // Redirect the confirmation page
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Route to display existing story posts
app.get("/viewposts", async (req, res) => {
  const loggedIn = req.session.loggedIn;
  try {
    // Fetch userPosts array from all documents
    const userPostsArray = await userCollection.find({}, { projection: { userPosts: 1 } }).toArray();

    // Extract userPosts from each document and flatten into a single array (storyPosts)
    const storyPosts = userPostsArray.flatMap(user => user.userPosts);

    // render story/posts onto the viewpost page
    res.render("viewposts", { storyPosts: storyPosts, loggedIn: loggedIn });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Route to handle comment submission
app.post("/post/comment", sessionValidation, async (req, res) => {
  const { postId, comment } = req.body;
  const username = req.session.username;

  try {
    // Find the post by postId
    const post = await userCollection.findOne({ "userPosts.postId": postId });
    if (!post) {
      res.status(404).json({ message: "Post not found" });
      return;
    }

    // Add the comment to the post's comments array
    post.userPosts.forEach(async (userPost) => {
      if (userPost.postId === postId) {
        // userPosts comments array
        userPost.comments.push({
          commenter: username,
          comment: comment,
          createdAt: new Date()
        });
      }
    });

    // Update the post in the database
    await userCollection.updateOne({ "userPosts.postId": postId }, { $set: post });

    res.status(200).json({ message: "Comment added successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.get("/journal", (req, res) => {
  res.render("journal");
});

app.get("/userpage", (req, res) => {
  res.render("userpage");
});

app.get("/signup", (req, res) => {
  res.render("signup");
});

app.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error(err);
      res.status(500).json({ message: "Internal server error" });
    } else {
      res.redirect("/");
    }
  });
});

app.post("/submitSignUp", async (req, res) => {
  const { username, password, email } = req.body;

  const schema = Joi.object({
    username: Joi.string().alphanum().max(20).required(),
    password: Joi.string().max(20).required(),
    email: Joi.string().email().required() // changed to include email
  });

  const validationResult = schema.validate({ username, password, email });

  if (validationResult.error != null) {
    const errorMessages = validationResult.error.details.map(detail => detail.message);
    return res.status(400).json({ error: errorMessages });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    await userCollection.insertOne({
      username: username,
      password: hashedPassword,
      email: email, // changed to include email
      savedDrafts: [],
      savedPosts: [],
      userPosts: []
    });

    console.log("Inserted user");

    req.session.loggedIn = true;
    req.session.username = username;

    res.status(200).json({ message: "User registered successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});


app.get("/login", (req, res) => {
  res.render("login");
});

app.post("/loggingIn", async (req, res) => {
  var username = req.body.username;
  var password = req.body.password;
  var email = req.body.email;


  const schema = Joi.object({
    username: Joi.string().alphanum().max(20).required(),
    password: Joi.string().required(),
    email: Joi.string().email().required()

  });

  const validationResult = schema.validate({ username, password, email});

  if (validationResult.error != null) {
    console.log(validationResult.error);
    res.render("invalidLogin");
    return;
  }

  const result = await userCollection
  .find({ username: username, email: email })
  .project({ 
      username: 1, 
      password: 1, 
      email: 1, 
      savedDrafts: 1, 
      savedPosts: 1, 
      userPosts: 1
      })
    .toArray();

  if (result.length === 0) {
    // Handle case when no user is found with the provided email
    res.status(400);
    res.render("invalidLogin");
    return;
  }

  console.log(result);
  if (result.length != 1) {
    res.status(400);
    //res.render("invalidLogin");
    console.log("invalidLogin");
  }
  if (await bcrypt.compare(password, result[0].password)) {
    console.log("correct password");
    req.session.loggedIn = true;
    req.session.name = result[0].name;
    req.session.email = result[0].email;
    req.session.savedDrafts = result[0].savedDrafts;
    req.session.savedPosts = result[0].savedPosts;
    req.session.userPosts = result[0].userPosts;
    req.session.cookie.maxAge = expireTime;

    res.redirect("/home");
    return;
  } else {
    res.status(400);
    res.render("invalidLogin");
  }
});

app.get("/profile", sessionValidation, async (req, res) => {

  const username = req.session.username;
  console.log(username);

  const result = await userCollection.findOne({ username });

  if (!result) {
    res.status(404);
    res.render("error", { message: "User not found" });
    return;
  }

  const { 
    savedDrafts, 
    savedPosts, 
    userPosts
  } = result;

  res.render("profile", { 
    savedDrafts, 
    savedPosts, 
    userPosts, 
    loggedIn: false, isloggedIn: false });
});

app.listen(port, () => {
  console.log(`Server is running on port: ${port}`);
});
