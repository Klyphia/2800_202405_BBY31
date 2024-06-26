require("./utils.js");

const express = require("express");
require("dotenv").config();
const session = require("express-session");
const MongoStore = require("connect-mongo");
const { ObjectId } = require("mongodb");
const multer = require("multer");
const bcrypt = require("bcryptjs");
const Joi = require("joi");
const nodemailer = require("nodemailer");
const bodyParser = require("body-parser");
const path = require("path");
const crypto = require("crypto");
const { v4: uuid } = require('uuid');
const cloudinary = require("cloudinary").v2;
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_CLOUD_KEY,
  api_secret: process.env.CLOUDINARY_CLOUD_SECRET
});
const storage = multer.memoryStorage()
const uploadForImage = multer({ storage: storage });
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

const postsCollection = database.db(mongodb_database).collection("posts");

const savedPostsCollection = database.db(mongodb_database).collection("savedPosts");

const draftsCollection = database.db(mongodb_database).collection("drafts");

const commentsCollection = database.db(mongodb_database).collection("comments");

const randomCollection = database.db(mongodb_database).collection("random_gen_collection");

const moodHistory = database.db(mongodb_database).collection("mood_history");

const flaggedCollection = database.db(mongodb_database).collection("flagged_posts");

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

app.use(express.static(__dirname + "/public"));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

function isValidSession(req) {
  if (req.session.loggedIn) {
    return true;
  }
  return false;
}

function sessionValidation(req, res, next) {
  if (!isValidSession(req)) {
    console.log("Going to login.");
    res.render("login");
  } else {
    next();
  }
}

// middleware for returning to array of all comments made by everyone
const fetchAndSortUserComments = async (req, res, next) => {
  try {
    // Fetch all comments from the commentsCollection
    const commentsArray = await commentsCollection
      .find({}, { projection: { _id: 0 } }) // Assuming you want to exclude the MongoDB _id field
      .toArray();

    // Sort the comments based on the createdAt field
    commentsArray.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Make the sorted comments array available in req object
    req.comments = commentsArray;
    next();
  } catch (error) {
    console.error('Error fetching or sorting comments:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

//... rest of your code

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.set("views", "./views"); // Specify the views directory
app.set("view engine", "ejs");

// inserting random data into random
// const randomData = {
//   avatar_array: ['examples/avatar1.png'], //tbd - root directory has to specified
//   dailyQuotes: "",  //tbd
//   randomUsernames: {
//     animal: [""], //tbd
//     color: [""] //tbd
//   }
// };

// randomCollection.insertOne(randomData)
// .then(result => {
//   console.log(`Successfully inserted document: ${result.insertedId}`);
// })
// .catch(error => {
//   console.log(`Failed to insert document: ${error}`);
// });

// Routes
app.get("/", sessionValidation, async (req, res) => {
  const username = req.session.username;
  const message = "Comments added successfully";

  // Fetch all posts from postsCollection
  const storyPosts = await postsCollection.find({}).toArray();

  // Sort the posts by date
  storyPosts.sort((a, b) => new Date(b.currentDate) - new Date(a.currentDate));

  res.render("home", { storyPosts: storyPosts, username: username, message: message });
});


app.get("/easterEgg", sessionValidation, async (req, res) => {
  const userPostsArray = await userCollection
    .find({}, { projection: { userPosts: 1 } })
    .toArray();
  const storyPosts = userPostsArray.flatMap((user) => user.userPosts);
  storyPosts.sort((a, b) => new Date(b.currentDate) - new Date(a.currentDate));
  res.render("easterEgg", { storyPosts: storyPosts });
});

// Route for creating user post - sends to create post page should not need to touch
app.get("/createPost", sessionValidation, async (req, res) => {
  const username = req.session.username;
  const result = await userCollection.findOne({ username });
  if (!result) {
    res.status(404);
    res.render("error", { message: "User not found" });
    return;
  }

  // Retrieve query parameters
  const { postObjectID, message } = req.query;

  // Decode URI components and parse comments if available
  const decodedMessage = message ? decodeURIComponent(message) : '';
  const decodedPostID = postObjectID ? decodeURIComponent(postObjectID) : '';

  let postId;
  if (ObjectId.isValid(decodedPostID)) {
    postId = new ObjectId(decodedPostID);
  }

  if (!postId) {
    // If postId is not valid, render createPost with empty fields
    return res.render('createPost', {
      postTitle: '',
      randomGenUsername: '',
      randomAvatar: '',
      postTag: '',
      postUploadImage: '',
      postLink: '',
      postContent: '',
      commentVisibility: '',
      postId: '',
      username: username
    });
  }

  const currentDraft = await draftsCollection.findOne({ postId: postId });

  if (!currentDraft) {
    return res.render('createPost', {
      postTitle: '',
      randomGenUsername: '',
      randomAvatar: '',
      postTag: '',
      postUploadImage: '',
      postLink: '',
      postContent: '',
      commentVisibility: '',
      postId: '',
      username: username
    });
  }

  // Render createPost with current draft details
  res.render('createPost', {
    postTitle: currentDraft.postTitle,
    randomGenUsername: " ",
    randomAvatar: " ",
    postTag: currentDraft.postTag,
    postUploadImage: currentDraft.postUploadImage,
    postLink: currentDraft.postLink,
    postContent: currentDraft.postContent,
    commentVisibility: currentDraft.commentVisibility,
    postId: currentDraft.postId,
    username: currentDraft.username
  });

  const draftRemovalStatus = await draftsCollection.deleteOne({ postId: postId });

  if (draftRemovalStatus) {
    console.log("Successfully removed draft after submission!");
  } else {
    console.log("Failed to remove draft!");
  }
});

const upload = multer();

app.post("/submitPost", sessionValidation, uploadForImage.single('image'), async function (req, res, next) {
  try {
    // Get form data from request body
    const { postTitle, randomGenUsername, randomAvatar, postTag, postLink, postContent, postId } = req.body;
    const commentVisibility = req.body.commentVisibility === 'true' ? true : false;
    const username = req.session.username;
    const currentDate = new Date();
    const invalidPosting = "Your Title, Tag, or Content is missing."

    console.log(username);
    console.log(commentVisibility);

    if (!postTitle || !postContent || !postTag) {
      // Redirect back to createPost page with error message as query parameter
      return res.redirect("/createPost?error=Missing%20Title/Tag/Content");
    }

    if (postTitle === null || postContent === null || postTag === null) {
      return res.render("createPost", { invalidPosting: invalidPosting });
    }

    let imageUID = null; // Default value for postUploadImage

    // Check if an image file was uploaded
    if (req.file) {
      // Upload image to Cloudinary if an image file is provided
      const buf64 = req.file.buffer.toString('base64');
      const result = await cloudinary.uploader.upload("data:image/png;base64," + buf64, {
        detection: "adv_face" // Enable advanced face detection
      });

      // Log the entire result object to inspect its structure
      console.log('Cloudinary upload result:', JSON.stringify(result, null, 2));

      // Extract the UID of the uploaded image
      imageUID = result.public_id;

      console.log(imageUID);

      // Check if faces are detected in the uploaded image
      const facesDetected = result.info && result.info.detection && result.info.detection.adv_face && result.info.detection.adv_face.data ? result.info.detection.adv_face.data.length : 0;
      console.log(`Faces detected: ${facesDetected}`);

      if (facesDetected > 0) {
        return res.status(400).render("invalidImageUpload");
      }
    }

    // Create the post object
    const post = {
      postId: postId ? new ObjectId(postId) : new ObjectId(), // Use existing postId if provided, else create new postId
      postTitle: postTitle,
      randomGenUsername: randomGenUsername,
      randomAvatar: randomAvatar,
      postTag: postTag,
      postUploadImage: imageUID, // Pass the image's UID to postUploadImage
      postLink: postLink,
      commentVisibility: commentVisibility,
      postContent: postContent,
      currentDate: currentDate,
      username: username
    };

    await postsCollection.insertOne(post);

    console.log(post);

    res.render('postConfirmation');
  } catch (error) {
    console.error('Error occurred:', error);
    res.status(500).json({ message: "Internal server error" });
  }
});


app.get("/postConfirmation", sessionValidation, async (req, res) => {
  res.render("postConfirmation");
});


// works perfectly where post will be moved to userPost folder if user submits their completed post
// do not change anything here!
app.post("/savePost", sessionValidation, upload.none(), async (req, res) => {
  try {
    const { postTitle, randomGenUsername, randomAvatar, postTag, postUploadImage, postLink, postContent, postId } = req.body;
    const commentVisibility = req.body.commentVisibility === 'true' ? true : false;
    const username = req.session.username;

    // Create a post object
    const post = {
      postId: postId ? new ObjectId(postId) : new ObjectId(), // Use existing postId if provided
      postTitle,
      randomGenUsername,
      randomAvatar,
      postTag,
      postUploadImage,
      postLink,
      commentVisibility,
      postContent,
      username: username
    };

    console.log(post);

    if (postId) {
      // If postId exists, update the existing draft
      await draftsCollection.updateOne(
        { postId: new ObjectId(postId) }, // Filter for the existing postId
        {
          $set: {
            postTitle: post.postTitle,
            randomGenUsername: post.randomGenUsername,
            randomAvatar: post.randomAvatar,
            postTag: post.postTag,
            postUploadImage: post.postUploadImage,
            postLink: post.postLink,
            commentVisibility: post.commentVisibility,
            postContent: post.postContent,
            username: post.username
          }
        }
      );
    } else {
      // If no postId, insert a new draft
      await draftsCollection.insertOne(post);
    }

    res.redirect("/postConfirmation"); // Redirect to confirmation page
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Route to display existing story posts
app.get("/viewposts", sessionValidation, fetchAndSortUserComments, async (req, res) => {
  const { postObjectID, username, message, commentSuccess } = req.query;

  console.log(postObjectID);

  let currentPost;

  try {
    // Convert postObjectID to ObjectId if necessary
    const postIdObj = new ObjectId(postObjectID);

    // current post object
    currentPost = await postsCollection.findOne({ postId: postIdObj });

  } catch (error) {
    console.error('Error converting postObjectID to ObjectId or querying the database:', error);
    res.status(500).json({ message: "Internal server error" });
    return;
  }

  if (!currentPost) {
    res.status(404).json({ message: "Post not found" });
    return;
  }

  console.log(currentPost);

  const postTitle = currentPost.postTitle;
  const postTag = currentPost.postTag;
  const postUploadImage = currentPost.postUploadImage;
  const randomUsername = currentPost.randomUsername;
  const randomAvatar = currentPost.randomAvatar;
  const postLink = currentPost.postLink;
  const postContent = currentPost.postContent;
  const commentVisibility = currentPost.commentVisibility;
  const postUsername = currentPost.username;

  console.log(postUploadImage);

  // Construct the Cloudinary URL using the UID
  const cloudinaryUrl = `https://res.cloudinary.com/dagffmxnr/image/upload/w_400,c_scale/${postUploadImage}.png`;

  console.log(commentVisibility);

  let matchingComments = [];

  if (commentVisibility) {
    // Loading in comments if commentVisibility is true
    try {
      // Query the database for comments with postId == postObjectID
      matchingComments = await commentsCollection.find({ postId: postObjectID }).toArray();

      // Sort the updated comments array by date from latest first to oldest last
      matchingComments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      matchingComments.forEach(comment => console.log(comment.comment));
    } catch (error) {
      console.error('Error querying comments:', error);
      res.status(500).json({ message: "Internal server error" });
      return;
    }
  } else if (postUsername === username) {
    // Loading in comments if commentVisibility is true
    try {
      // Query the database for comments with postId == postObjectID
      matchingComments = await commentsCollection.find({ postId: postObjectID }).toArray();

      // Sort the updated comments array by date from latest first to oldest last
      matchingComments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      matchingComments.forEach(comment => console.log(comment.comment));
    } catch (error) {
      console.error('Error querying comments:', error);
      res.status(500).json({ message: "Internal server error" });
      return;
    }
  }

  // Render the view with the updated comments array
  res.render('viewpost', {
    postTitle: postTitle,
    postId: postObjectID,
    randomUsername: randomUsername,
    randomAvatar: randomAvatar,
    postTag: postTag,
    postUploadImage: cloudinaryUrl,
    postLink: postLink,
    postContent: postContent,
    commentVisibility: commentVisibility,
    sessionUsername: username,
    message: message,
    comments: matchingComments,
    commentSuccess: commentSuccess,
    postUsername: postUsername
  });
});

// Route to handle comment submission
app.post("/post/comment", sessionValidation, async (req, res) => {
  let { sessionUsername, postId, postTag, postUploadImage, postLink, postTitle, postContent, commentVisibility, comment, message, commentSuccess } = req.body;

  try {
    const newCommentsData = {
      postId: postId,
      commenter: sessionUsername,
      comment: comment,
      createdAt: new Date(),
    };

    const insertedComment = await commentsCollection.insertOne(newCommentsData);
    console.log(`Successfully inserted document: ${insertedComment.insertedId}`);

    let currentPost;
    let matchingComments = [];

    currentPost = await postsCollection.findOne({ postId: new ObjectId(postId) });

    const postUsername = currentPost.username;

    console.log(postUsername);

    commentVisibility = req.body.commentVisibility === 'true';
    console.log(commentVisibility);

    if (commentVisibility) {
      // Query the database for comments with postId == postId
      matchingComments = await commentsCollection.find({ postId: postId }).toArray();

      // Sort the updated comments array by date from latest first to oldest last
      matchingComments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } else if (sessionUsername === postUsername) {
      // Query the database for comments with postId == postId
      matchingComments = await commentsCollection.find({ postId: postId }).toArray();

      // Sort the updated comments array by date from latest first to oldest last
      matchingComments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    // Usage
    //console.log(stringEquals(sessionUsername, postUsername)); 
    console.log(commentVisibility);

    console.log(matchingComments);

    return res.render('viewpost', {
      postTitle: postTitle,
      postId: postId,
      postTag: postTag,
      postUploadImage: postUploadImage,
      postLink: postLink,
      postContent: postContent,
      comments: matchingComments,
      commentVisibility: commentVisibility,
      sessionUsername: sessionUsername,
      message: message,
      comments: matchingComments,
      commentSuccess: commentSuccess,
      postUsername: postUsername
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.get("/journal", sessionValidation, async (req, res) => {
  res.render("journal", { username: req.session.username });
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
    email: Joi.string().email().required(), // changed to include email
  });

  const validationResult = schema.validate({ username, password, email });

  if (validationResult.error != null) {
    const errorMessages = validationResult.error.details.map(
      (detail) => detail.message
    );
    return res.status(400).json({ error: errorMessages });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    await userCollection.insertOne({
      username: username,
      password: hashedPassword,
      email: email, // changed to include email
      resetPasswordToken: "",
      resetPasswordExpires: ""
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

app.get("/passwordReset", (req, res) => {
  res.render("passwordResetIntialized");
});

app.post("/resetPassword", async (req, res) => {
  const useremail = req.body.email;
  const username = req.body.username;

  try {
    // Checking if the email exists in the userCollection
    const userEmail = await userCollection.findOne({ email: useremail });

    // Checking if the useranme exists in the userCollection
    const userName = await userCollection.findOne({ username: username });

    if (!userEmail && !userName) {
      return res.status(404).render("noUserFoundPage");
    }

    // Generating a unique token
    const token = crypto.randomBytes(20).toString("hex");

    // Setting token expiration time (1 hour from now)
    const tokenExpiry = Date.now() + 3600000; // 1 hour in milliseconds

    // Updating the user document with the reset token and expiry
    await userCollection.updateOne(
      { email: useremail, username: username },
      { $set: { resetPasswordToken: token, resetPasswordExpires: tokenExpiry } }
    );

    // Set up Nodemailer transport
    const transporter = nodemailer.createTransport({
      service: "gmail",
      host: "smtp.gmail.com",
      port: 587,
      secure: false, // true of 465, false for all else
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.APP_PASS,
      },
    });

    // Constructing the reset URL
    const resetURL = `http://${req.headers.host}/reset/${token}`;

    // Send the email with the reset link
    const mailOptions = {
      to: useremail,
      from: process.env.EMAIL_USER,
      subject: "Password Reset",
      text: `You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n
             Please click on the following link, or paste this into your browser to complete the process:\n\n
             ${resetURL}\n\n
             If you did not request this, please ignore this email and your password will remain unchanged.\n`,
    };

    const sendMail = async (transporter, mailOptions) => {
      try {
        await transporter.sendMail(mailOptions);
        console.log("Email has been sent!");
      } catch (error) {
        console.error(error);
      }
    };

    await sendMail(transporter, mailOptions);

    res.status(200);
    res.render("resetPasswordMessage");
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal server error.");
  }
});

app.get("/reset/:token", async (req, res) => {
  try {
    const user = await userCollection.findOne({
      resetPasswordToken: req.params.token,
      resetPasswordExpires: { $gt: Date.now() }, // Ensure the token has not expired
    });

    if (!user) {
      res.status(400);
      res.render("passwordResetExpired");
    }

    // Render a form to set the new password
    res.render("passwordResetForm", { token: req.params.token });
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal server error.");
  }
});

app.post("/resetPassword/:token", async (req, res) => {
  const { token } = req.params;
  const { password, confirmPassword } = req.body;

  if (password !== confirmPassword) {
    return res.status(400).send("Passwords do not match.");
  }

  try {
    const user = await userCollection.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res
        .status(400)
        .send("Password reset token is invalid or has expired.");
    }
    console.log("User found:", user.email);
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    await userCollection.updateOne(
      { email: user.email },
      {
        $set: { password: hashedPassword },
        $unset: { resetPasswordToken: "", resetPasswordExpires: "" },
      }
    );

    res.status(200).render("passwordResetSuccess");
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal server error.");
  }
});

app.post("/loggingIn", async (req, res) => {
  var username = req.body.username;
  var password = req.body.password;
  // var email = req.body.email;

  const schema = Joi.object({
    username: Joi.string().alphanum().max(20).required(),
    password: Joi.string().required(),
  });

  const validationResult = schema.validate({ username, password });

  if (validationResult.error != null) {
    console.log(validationResult.error);
    res.render("invalidLogin");
    return;
  }

  const result = await userCollection
    .find({ username: username })
    .project({
      _id: 1,
      username: 1,
      password: 1,
      email: 1,
      resetPasswordToken: 1,
      resetPasswordExpires: 1
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
    console.log("Session: " + req.session.loggedIn);
    req.session.userid = result[0]._id;
    req.session.username = result[0].username;
    req.session.email = result[0].email;
    req.session.resetPasswordToken = result[0].resetPasswordToken;
    req.session.resetPasswordExpires = result[0].resetPasswordExpires;
    req.session.cookie.maxAge = expireTime;

    res.redirect("/");
    return;
  } else {
    res.status(400);
    res.render("invalidLogin");
  }
});

app.get("/profile", sessionValidation, async (req, res) => {
  const username = req.session.username;
  const email = req.session.email;
  console.log(email);
  console.log(req.session.userid);

  const result = await userCollection.findOne({ username });

  if (!result) {
    res.status(404);
    res.render("error", { message: "User not found" });
    return;
  }

  const userSavedDrafts = await draftsCollection.find({ username }).toArray();

  const userSavedPosts = await savedPostsCollection.find({ sessionUsername: username }).toArray();

  const userMadePosts = await postsCollection.find({ username }).toArray();

  const savedDrafts = userSavedDrafts;

  const savedPosts = userSavedPosts;

  const userPosts = userMadePosts;

  res.render("profile", {
    username,
    savedDrafts,
    savedPosts,
    userPosts,
    username: req.session.username,
    email: req.session.email,
  });
});

app.get("/savedDrafts", sessionValidation, async (req, res) => {
  const username = req.session.username;
  const message = "Comments added successfully";
  const result = await userCollection.findOne({ username });
  if (!result) {
    res.status(404);
    res.render("error", { message: "User not found" });
    return;
  }

  const userSavedDrafts = await draftsCollection.find({ username }).toArray();
  const savedDrafts = userSavedDrafts;

  res.render("userDraftsPage", { savedDrafts: savedDrafts, username: username, message: message });
});

app.get("/savedPosts", sessionValidation, async (req, res) => {
  const username = req.session.username;
  const result = await userCollection.findOne({ username });
  if (!result) {
    res.status(404);
    res.render("error", { message: "User not found" });
    return;
  }

  const userSavedPosts = await savedPostsCollection.find({ sessionUsername: username }).toArray();
  const savedPosts = userSavedPosts;

  res.render("userSavedPostsPage", { savedPosts: savedPosts });
});

app.post('/savePostToUser', sessionValidation, async (req, res) => {
  const username = req.session.username;
  const { postId } = req.body;


  try {
    console.log('Request received to save post:', postId);

    // Convert postId to ObjectId
    const postObjectId = new ObjectId(postId);

    // Fetch the post from the posts collection using _id field
    const post = await postsCollection.findOne({ postId: postObjectId });
    console.log(postId);
    console.log(post);
    if (!post) {
      console.log('Post not found');
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    console.log('Post found:', post);

    // // Check if the post is already saved by the user
    // const user = await userCollection.findOne({ username: username });
    // if (!user) {
    //   console.log('User not found');
    //   return res.status(404).json({ success: false, message: 'User not found' });
    // }

    // console.log('User found:', user);

    // if (user.savedPosts.some(savedPost => savedPost.equals(post._id))) {
    //   console.log('Post already saved by user');
    //   return res.status(400).json({ success: false, message: 'This post has already been saved!' });
    // }
    let { sessionUsername, postTag, postUploadImage, postLink, postTitle, postContent, commentVisibility, comments, message } = req.body;

    const alreadySaved = await savedPostsCollection.findOne({ postId: postObjectId });
    if (alreadySaved) {
      console.log('Post already saved');
      return res.status(404).json({ success: false, message: 'Post already saved' });
    }

    const currentPost = {
      postId: postObjectId,
      creatorUsername: post.username,
      sessionUsername: username,
      postTag: post.postTag,
      postUploadImage: post.postUploadImage,
      postLink: post.postLink,
      postTitle: post.postTitle,
      postContent: post.postContent,
      commentVisibility: post.commentVisibility,
    }
    // Add the post to the user's savedPosts array
    await savedPostsCollection.insertOne(
      currentPost

    );

    console.log('Post saved successfully');
    res.json({ success: true, message: 'Post saved successfully!' });
  } catch (error) {
    console.error('Error saving post:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

app.post('/reportPost', sessionValidation, async (req, res) => {
  const username = req.session.username;
  const { postId } = req.body;


  try {
    console.log('Request received to flag post:', postId);

    // Convert postId to ObjectId
    const postObjectId = new ObjectId(postId);

    // Fetch the post from the posts collection using _id field
    const post = await postsCollection.findOne({ postId: postObjectId });
    console.log(postId);
    console.log(post);
    if (!post) {
      console.log('Post not found');
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    console.log('Post found:', post);

    // // Check if the post is already saved by the user
    // const user = await userCollection.findOne({ username: username });
    // if (!user) {
    //   console.log('User not found');
    //   return res.status(404).json({ success: false, message: 'User not found' });
    // }

    // console.log('User found:', user);

    // if (user.savedPosts.some(savedPost => savedPost.equals(post._id))) {
    //   console.log('Post already saved by user');
    //   return res.status(400).json({ success: false, message: 'This post has already been saved!' });
    // }
    //let {sessionUsername, postTag, postUploadImage, postLink, postTitle, postContent, commentVisibility, comments, message} = req.body;

    const alreadyFlagged = await flaggedCollection.findOne({ postId: postObjectId });
    if (alreadyFlagged) {
      console.log('Post already flagged');
      return res.status(404).json({ success: false, message: 'Post already flagged' });
    }

    let flaggedCounter = 0;

    flaggedCounter++;

    console.log(flaggedCounter);

    const flaggedPost = {
      postId: postObjectId,
      creatorUsername: post.username,
      sessionUsername: username,
      postTag: post.postTag,
      postUploadImage: post.postUploadImage,
      postLink: post.postLink,
      postTitle: post.postTitle,
      postContent: post.postContent,
      commentVisibility: post.commentVisibility,
      flaggedCounter: flaggedCounter
    }
    // Add the post to the user's savedPosts array
    await flaggedCollection.insertOne(
      flaggedPost

    );

    console.log('Post flagged successfully');
    res.json({ success: true, message: 'Post was flagged!' });
  } catch (error) {
    console.error('Error saving post:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

app.get("/userPosts", sessionValidation, async (req, res) => {
  const username = req.session.username;
  const message = "Comments added successfully";
  const result = await userCollection.findOne({ username });
  if (!result) {
    res.status(404);
    res.render("error", { message: "User not found" });
    return;
  }
  const userMadePosts = await postsCollection.find({ username }).toArray();
  const userPosts = userMadePosts;
  console.log(userPosts);
  res.render("userPostsPage", { userPosts: userPosts, username: username, message: message });
});

app.post("/saveJournalEntry", sessionValidation, async (req, res) => {
  try {
    const userId = req.session.userid;
    const { entry } = req.body; // Assuming these are the fields in your journal entry
    const timestamp = Date.now();
    console.log(timestamp);

    // Check if there's already a document in mood_history with the user ID
    let userMoodHistory = await moodHistory.findOne({ userId: userId });

    if (userMoodHistory) {
      // If document exists, update it with the new entry
      await moodHistory.updateOne(
        { userId: userId },
        { $push: { entries: { entry, timestamp } } }
      );
    } else {
      // If no document exists, create a new one
      await moodHistory.insertOne({
        userId: userId,
        entries: [{ entry, timestamp }],
      });
    }

    res.status(200).json({ message: "Journal entry saved successfully" });
  } catch (error) {
    console.error("Error saving journal entry:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.get('/getMoodData', sessionValidation, async (req, res) => {
  const userId = req.session.userid;
  try {
    const userMoodData = await moodHistory.findOne({ userId: userId });
    if (userMoodData) {
      res.json(userMoodData.mood);
      console.log(userMoodData.mood);
    } else {
      res.json([]);
    }
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/getJournalEntries', sessionValidation, async (req, res) => {
  const userId = req.session.userid;
  console.log(userId);
  try {
    const user = await moodHistory.findOne({ userId: userId });
    if (!user) {
      return;
    }
    const entries = user.entries || []; // If 'entries' field does not exist, default to an empty array
    res.json(entries);
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/updateJournalEntry', sessionValidation, async (req, res) => {
  try {
    const userId = req.session.userid;
    const { timestamp, entry } = req.body;

    // Update the specific entry in the database
    const result = await moodHistory.updateOne(
      { userId: userId, 'entries.timestamp': timestamp },
      { $set: { 'entries.$.entry': entry } }
    );

    if (result.modifiedCount > 0) {
      res.json({ success: true });
    } else {
      res.json({ success: false, message: 'No entry found to update' });
    }
  } catch (error) {
    console.error('Error updating journal entry:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

app.get("/viewEntries", sessionValidation, async (req, res) => {
  res.render("viewEntries", { username: req.session.username });
});

app.get("/moodHistory", sessionValidation, async (req, res) => {
  res.render("moodHistory", { username: req.session.username });
});

app.post("/saveMood", sessionValidation, async (req, res) => {
  try {
    const userId = req.session.userid;
    const { colour } = req.body;
    console.log(colour);
    const timestamp = new Date();

    let userMoodHistory = await moodHistory.findOne({ userId: userId });

    if (userMoodHistory) {
      await moodHistory.updateOne(
        { userId: userId },
        { $push: { mood: { colour, timestamp } } }
      );
    } else {
      await moodHistory.insertOne({
        userId: userId,
        mood: [{ colour, timestamp }],
      });
    }

    res.status(200).json({ message: "Mood saved successfully" });
  } catch (error) {
    console.error("Error saving mood:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.use("/*", (req, res) => {
  res.status(404);
  res.render('404');
});


app.listen(port, () => {
  console.log(`Server is running on port: ${port}`);
});
