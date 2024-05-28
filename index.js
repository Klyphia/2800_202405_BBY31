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
const cloudinary = require("cloudinary");
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

const commentsCollection = database.db(mongodb_database).collection("comments");

const randomCollection = database.db(mongodb_database).collection("random_gen_collection");

const moodHistory = database.db(mongodb_database).collection("mood_history");

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
//   dailyQuotes: "Bye bye",  //tbd
//   randomUsernames: {
//     animal: ["Cat"], //tbd
//     color: ["Nyan"] //tbd
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
  const message = "Comments added succesfully";
  const userPostsArray = await userCollection
    .find({}, { projection: { userPosts: 1 } })
    .toArray();
  const storyPosts = userPostsArray.flatMap((user) => user.userPosts);
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

// Route for creating user post
app.get("/createPost", sessionValidation, async (req, res) => {
  const username = req.session.username;
  const result = await userCollection.findOne({ username });
  if (!result) {
    res.status(404);
    res.render("error", { message: "User not found" });
    return;
  }

  // Retrieve query parameters
  const { title, randomUsername, randomAvatar, tag, image, link, content, comments, visibility, postId } = req.query;
  console.log(postId);
  // Decode URI components and parse comments if available
  const decodedTitle = title ? decodeURIComponent(title) : '';
  const decodedRandomUsername = randomUsername ? decodeURIComponent(randomUsername) : '';
  const decodedRandomAvatar = randomAvatar ? decodeURIComponent(randomAvatar) : '';
  const decodedTag = tag ? decodeURIComponent(tag) : '';
  const decodedImage = image ? decodeURIComponent(image) : '';
  const decodedLink = link ? decodeURIComponent(link) : '';
  const decodedContent = content ? decodeURIComponent(content) : '';
  const parsedComments = comments ? JSON.parse(decodeURIComponent(comments)) : [];
  const decodedVisibility = visibility ? decodeURIComponent(visibility) : '';
  const decodedPostID = postId ? decodeURIComponent(postId) : '';

  // define function to get random elements from an array
  function getRandomElement(array) {
    return array[Math.floor(Math.random() * array.length)];
  }

  async function getRandomData(username, avatar) {
    try {
      const randomData = await randomCollection.findOne({});
      if (!randomData) {
        throw new Error('No random data found');
      }

      const randomGenUsername = username || getRandomElement(randomData.name.animal) + getRandomElement(randomData.name.color);
      const randomAvatar = avatar || getRandomElement(randomData.avatar_array);

      return { randomGenUsername, randomAvatar };
    } catch (error) {
      console.error(`Failed to retrieve random data ${error}`);
      return { randomGenUsername: '', randomAvatar: '' };
    }
  }

  // Use the function to get random data
  getRandomData(decodedRandomUsername, decodedRandomAvatar).then(({ randomGenUsername, randomAvatar }) => {

    // Now you have randomUsername and randomAvatar, you can proceed with your logic
    res.render('createPost', {
      postTitle: decodedTitle,
      randomGenUsername: randomGenUsername,
      randomAvatar: randomAvatar,
      postTag: decodedTag,
      postUploadImage: decodedImage,
      postLink: decodedLink,
      postContent: decodedContent,
      comments: parsedComments,
      commentVisibility: decodedVisibility,
      postId: decodedPostID
    });
  });
});

const upload = multer();

app.post("/submitPost", sessionValidation, uploadForImage.single('image'), async function (req, res, next) {
  try {
    // Get form data from request body
    const { postTitle, randomGenUsername, randomAvatar, postTag, postLink, postContent, postId } = req.body;
    const commentVisibility = req.body.commentVisibility === 'true' ? true : false;
    const username = req.session.username;
    const currentDate = new Date();

    console.log(username);

    if (!postTitle || !postContent || !postTag) {
      // Redirect back to createPost page with error message as query parameter
      return res.redirect("/createPost?error=Missing%20Title/Tag/Content");
    }

    if (postTitle === null || postContent === null || postTag === null) {
      return res.render("createPost", { invalidPosting: invalidPosting });
    }

    // Upload image to Cloudinary if an image file is provided
    let buf64 = req.file.buffer.toString('base64');
    cloudinary.uploader.upload("data:image/png;base64," + buf64, async function (result) {
      console.log(result);
      // Extract the UID of the uploaded image
      const imageUID = result.public_id;

      // Now, you can use the imageUID as needed, for example, pass it to postUploadImage
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
        comments: [], // Initialize an empty comments array for the post
        // Add any additional properties here
      };

      const user = await userCollection.findOne({ username: username });

      if (user) {
        // find post with postId in userCollection
        let existingPost = user.savedDrafts.find(draft => draft.postId.toString() === postId);

        if (existingPost) {
          // Move post to userPosts and remove from savedDrafts
          await userCollection.updateOne(
            { username: username },
            {
              $push: { userPosts: post },
              $pull: { savedDrafts: { postId: new ObjectId(postId) } }
            }
          );
          console.log(`Post with postId ${postId} moved to userPosts and removed from savedDrafts.`);
        } else {
          // Add new post to userPosts
          await userCollection.updateOne(
            { username: username },
            { $push: { userPosts: post } }
          );
          console.log(`New post created and added to userPosts with postId ${post.postId}.`);
        }
      } else {
        console.error("User not found.");
      }

      res.status(200).json({ message: "submit post operation was successful" });
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
});


// works perfectly where post will be moved to userPost folder if user submits their completed post
// do not change anything here!
app.post("/savePost", sessionValidation, upload.none(), async (req, res) => {
  try {
    const { postTitle, randomGenUsername, randomAvatar, postTag, postUploadImage, postLink, postContent, postId } = req.body;
    const commentVisibility = req.body.commentVisibility === 'true';
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
      comments: [], // Initialize an empty comments array for the post
    };

    console.log(post);

    if (postId) {
      // If postId exists, update the existing draft
      await userCollection.updateOne(
        { username, "savedDrafts.postId": new ObjectId(postId) },
        { $set: { "savedDrafts.$": post } }
      );
    } else {
      // If no postId, insert a new draft
      await userCollection.updateOne(
        { username },
        { $push: { savedDrafts: post } }
      );
    }

    const user = await userCollection.findOne({ username });
    console.log(`Number of saved drafts: ${user.savedDrafts.length}`);

    res.redirect("/postConfirmation"); // Redirect to confirmation page
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Route to display existing story posts
app.get("/viewposts", sessionValidation, fetchAndSortUserComments, async (req, res) => {
  const { title, randomUsername, randomUserAvatar, tag, image, link, content, visibility, postObjectID, username, message, commentSuccess } = req.query;
  //const parsedComments = JSON.parse(decodeURIComponent(comments));

  //console.log(username);

  //console.log(postObjectID);

  const allComments = req.comments; // Access sorted comments

  const tempCommentsArray = [];

  allComments.forEach(eachComment => {
    if (eachComment.postId == postObjectID) {
      tempCommentsArray.push(eachComment);
    }
  });

  // Sort tempCommentsArray by date from latest first to oldest last
  tempCommentsArray.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  // Construct the Cloudinary URL using the UID
  const cloudinaryUrl = `https://res.cloudinary.com/dagffmxnr/image/upload/w_400,c_scale/${image}.png`;

  res.render('viewpost', {
    postTitle: decodeURIComponent(title),
    postId: decodeURIComponent(postObjectID),
    randomUsername: decodeURIComponent(randomUsername),
    randomAvatar: decodeURIComponent(randomUserAvatar),
    postTag: decodeURIComponent(tag),
    postUploadImage: cloudinaryUrl,
    postLink: decodeURIComponent(link),
    postContent: decodeURIComponent(content),
    comments: tempCommentsArray,
    commentVisibility: decodeURIComponent(visibility),
    sessionUsername: username,
    message: message,
    commentSuccess: commentSuccess
  });
});

// Route to handle comment submission
app.post("/post/comment", sessionValidation, async (req, res) => {
  const { sessionUsername, postId, postTag, postUploadImage, postLink, postTitle, postContent, commentVisibility, comments, comment, message, commentSuccess } = req.body;

  try {
    const newCommentsData = {
      postId: postId,
      commenter: sessionUsername,
      comment: comment,
      createdAt: new Date(),
    }

    const insertionResult = await commentsCollection.insertOne(newCommentsData);

    console.log(`Successfully inserted document: ${insertionResult.insertedId}`);

    console.log(commentSuccess);

    return res.render('viewpost', {
      postTitle: postTitle,
      postId: postId,
      //randomUsername: decodeURIComponent(randomUsername),
      //randomAvatar: decodeURIComponent(randomUserAvatar),
      postTag: postTag,
      postUploadImage: postUploadImage,
      postLink: postLink,
      postContent: postContent,
      comments: comments,
      commentVisibility: commentVisibility,
      sessionUsername: sessionUsername,
      message: message,
      commentSuccess: commentSuccess
    });

    // Redirect back to the post view with a success message
    //return res.redirect(`/viewposts?postObjectID=${postId}&commentSuccess=true&sessionUsername=${sessionUsername}&postUploadImage=${postUploadImage}&postLink=${postLink}&postTitle=${postTitle}&commentVisibility=${commentVisibility}&comments=${comments}&message=Comment added successfully`);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }

  const post = await userCollection.findOne({ "userPosts.postId": postId });

  const tempPostId = post.postId;

  console.log(tempPostId);

  // Find comments by postID
  const postComments = await commentsCollection.find({ postID: tempPostId }).toArray();

  res.render('viewpost', {
    postID: postId, // Change postId to postID
    postTitle: decodeURIComponent(title),
    randomUsername: decodeURIComponent(randomUsername),
    randomAvatar: decodeURIComponent(randomUserAvatar),
    postTag: decodeURIComponent(tag),
    postUploadImage: decodeURIComponent(image),
    postLink: decodeURIComponent(link),
    postContent: decodeURIComponent(content),
    comments: postComments,
    commentVisibility: decodeURIComponent(visibility),
    commenterUsername: commenterUsername
  });
  console.log(postComments);
});

app.post("/post/comment", sessionValidation, async (req, res) => {
  const { postId, comment } = req.body;
  const username = req.session.username;

  // Basic validation
  if (!postId || !comment || !username) {
    console.log(postId);
    console.log(comment);
    console.log(username);
    return res.status(400).json({ message: "postID, comment, and username are required" });
  }

  try {
    // Check if the user exists
    const user = await userCollection.findOne({ username });
    if (!user) {
      res.status(404);
      return res.render("error", { message: "User not found" });
    }

    // Insert the comment into the commentsCollection
    const commenterUsername = user.username;
    const commentsData = {
      postId: postId,
      commenterUsername: commenterUsername,
      comment: comment,
      createdAt: new Date()
    };

    // Update the post in the database
    await userCollection.updateOne({ "userPosts.postId": postId }, { $set: post });

    // insert commentsData in commentsCollection 
    const insertionResult = await commentsCollection.insertOne(commentsData);
    console.log(`Successfully inserted document: ${insertionResult.insertedId}`);
    res.status(200).json({ message: "Comment added successfully" });

  } catch (error) {
    console.error(`Failed to insert document: ${error}`);
    res.status(500).json({ message: "Internal server error" });
  }
});


app.get("/journal", sessionValidation, async (req, res) => {
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
      resetPasswordExpires: "",
      savedDrafts: [],
      savedPosts: [],
      userPosts: [],
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

  try {
    // Checking if the email exists in the userCollection
    const user = await userCollection.findOne({ email: useremail });

    if (!user) {
      return res.status(404).render("noUserFoundPage");
    }

    // Generating a unique token
    const token = crypto.randomBytes(20).toString("hex");

    // Setting token expiration time (1 hour from now)
    const tokenExpiry = Date.now() + 3600000; // 1 hour in milliseconds

    // Updating the user document with the reset token and expiry
    await userCollection.updateOne(
      { email: useremail },
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

    sendMail(transporter, mailOptions);

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
      resetPasswordExpires: 1,
      savedDrafts: 1,
      savedPosts: 1,
      userPosts: 1,
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
    req.session.savedDrafts = result[0].savedDrafts;
    req.session.savedPosts = result[0].savedPosts;
    req.session.userPosts = result[0].userPosts;
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

  const { savedDrafts, savedPosts, userPosts } = result;

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
  const result = await userCollection.findOne({ username });
  if (!result) {
    res.status(404);
    res.render("error", { message: "User not found" });
    return;
  }
  const { savedDrafts } = result;
  res.render("userDraftsPage", { savedDrafts });
});

app.get("/savedPosts", sessionValidation, async (req, res) => {
  const username = req.session.username;
  const result = await userCollection.findOne({ username });
  if (!result) {
    res.status(404);
    res.render("error", { message: "User not found" });
    return;
  }
  const { savedPosts } = result;
  res.render("userSavedPostsPage", { savedPosts });
});

app.get("/userPosts", sessionValidation, async (req, res) => {
  const username = req.session.username;
  const result = await userCollection.findOne({ username });
  if (!result) {
    res.status(404);
    res.render("error", { message: "User not found" });
    return;
  }
  const { userPosts } = result;
  res.render("userPostsPage", { userPosts });
});

app.post("/saveJournalEntry", sessionValidation, async (req, res) => {
  try {
    const userId = req.session.userid;
    const { entry } = req.body; // Assuming these are the fields in your journal entry
    const timestamp = new Date();

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

app.get('/getJournalEntries', sessionValidation, async (req, res) => {
  const userId = req.session.userid;
  console.log(userId);
  try {
    const user = await moodHistory.findOne({ userId: userId });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    const entries = user.entries || []; // If 'entries' field does not exist, default to an empty array
    res.json(entries);
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

app.get("/viewEntries", sessionValidation, async (req, res) => {
  res.render("viewEntries");
});

app.get("/moodHistory", sessionValidation, async (req, res) => {
  res.render("moodHistory");
});

app.listen(port, () => {
  console.log(`Server is running on port: ${port}`);
});
