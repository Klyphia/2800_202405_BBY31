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